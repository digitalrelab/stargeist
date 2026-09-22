import { Deferred, Effect, Fiber, Layer, Redacted } from "effect";
import { TestClock } from "effect/testing";
import { FetchHttpClient } from "effect/unstable/http";
import { expect, it, vi } from "vite-plus/test";
import { OpenRouter } from "./openrouter";

const key = Redacted.make({ kind: "apiKey", key: "test-secret-key" });
const runtime = OpenRouter.make.pipe(Effect.flatMap((adapter) => adapter.open(key)));
const http = (fetch: typeof globalThis.fetch) =>
  FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)));

it("normalizes every model and its capabilities without applying agent policy or exposing the key", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({
      data: [
        {
          id: "anthropic/claude-sonnet",
          name: "Anthropic: Claude Sonnet",
          supported_parameters: ["tools", "temperature"],
          architecture: {
            input_modalities: ["text", "image", "video", "audio", "unsupported-future-type"],
            output_modalities: ["text"],
          },
          reasoning: { default_enabled: true },
          pricing: { prompt: "0.000002", completion: "0.000015" },
          ignored: true,
        },
        {
          id: "example/no-tools",
          name: "No tools",
          supported_parameters: ["temperature"],
          architecture: { input_modalities: ["text"], output_modalities: ["text"] },
          pricing: { prompt: "0", completion: "0" },
        },
        {
          id: "example/unpriced",
          name: "Unpriced",
          supported_parameters: ["tools", "reasoning"],
          architecture: { input_modalities: ["text", "file"], output_modalities: ["text"] },
        },
        {
          id: "example/image",
          name: "Image only",
          supported_parameters: ["tools"],
          architecture: { input_modalities: ["text"], output_modalities: ["image"] },
          pricing: { prompt: "0", completion: "0" },
        },
      ],
    }),
  );
  const models = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.models),
      Effect.provide(http(fetch)),
    ),
  );
  expect(models).toEqual([
    {
      reference: { providerId: "openrouter", modelId: "anthropic/claude-sonnet" },
      name: "Claude Sonnet",
      publisher: { id: "anthropic", name: "Anthropic" },
      pricing: { inputPerMillionTokens: 2, outputPerMillionTokens: 15 },
      capabilities: {
        toolCalling: true,
        reasoning: true,
        inputModalities: ["text", "image", "video", "audio"],
        outputModalities: ["text"],
      },
    },
    {
      reference: { providerId: "openrouter", modelId: "example/no-tools" },
      name: "No tools",
      publisher: { id: "example", name: "example" },
      pricing: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 },
      capabilities: {
        toolCalling: false,
        reasoning: false,
        inputModalities: ["text"],
        outputModalities: ["text"],
      },
    },
    {
      reference: { providerId: "openrouter", modelId: "example/unpriced" },
      name: "Unpriced",
      publisher: { id: "example", name: "example" },
      pricing: null,
      capabilities: {
        toolCalling: true,
        reasoning: true,
        inputModalities: ["text", "file"],
        outputModalities: ["text"],
      },
    },
    {
      reference: { providerId: "openrouter", modelId: "example/image" },
      name: "Image only",
      publisher: { id: "example", name: "example" },
      pricing: { inputPerMillionTokens: 0, outputPerMillionTokens: 0 },
      capabilities: {
        toolCalling: true,
        reasoning: false,
        inputModalities: ["text"],
        outputModalities: ["image"],
      },
    },
  ]);
  const [url, init] = fetch.mock.calls[0]!;
  let request: URL;
  if (url instanceof URL) request = url;
  else if (typeof url === "string") request = new URL(url);
  else request = new URL(url.url);
  expect(request.pathname).toBe("/api/v1/models");
  expect(request.searchParams.get("output_modalities")).toBe("all");
  expect(request.searchParams.get("supported_parameters")).toBeNull();
  expect(request.searchParams.get("sort")).toBe("most-popular");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-secret-key");
});

it("rejects ambiguous model catalogs", async () => {
  const record = {
    id: "publisher/model",
    name: "Model",
    supported_parameters: ["tools"],
    architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    pricing: { prompt: "0", completion: "0" },
  };
  const error = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.models),
      Effect.flip,
      Effect.provide(http(async () => Response.json({ data: [record, record] }))),
    ),
  );
  expect(error.code).toBe("InvalidResponse");
});

it("preserves model names with non-publisher colons and treats malformed prices as unavailable", async () => {
  const models = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.models),
      Effect.provide(
        http(async () =>
          Response.json({
            data: [
              {
                id: "example/think-fast",
                name: "Think: Fast",
                supported_parameters: ["tools"],
                architecture: { input_modalities: ["text"], output_modalities: ["text"] },
                pricing: { prompt: " ", completion: "0x1" },
              },
            ],
          }),
        ),
      ),
    ),
  );
  expect(models[0]).toMatchObject({
    name: "Think: Fast",
    publisher: { id: "example", name: "example" },
    pricing: null,
  });
});

it.each([
  [401, "InvalidCredential"],
  [403, "InvalidCredential"],
  [429, "RateLimited"],
  [503, "ProviderUnavailable"],
  [302, "InvalidResponse"],
])("maps HTTP %s without exposing provider error contents", async (status, code) => {
  const result = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.check),
      Effect.flip,
      Effect.provide(http(async () => new Response("test-secret-key", { status: Number(status) }))),
    ),
  );
  expect(result.code).toBe(code);
  expect(JSON.stringify(result)).not.toContain("test-secret-key");
});

it.each([
  [JSON.stringify({ data: { is_management_key: true } }), "UnsupportedCredential"],
  [JSON.stringify({ data: { label: "test-secret-key" } }), "InvalidResponse"],
  ["test-secret-key", "InvalidResponse"],
  ["x".repeat(65537), "InvalidResponse"],
])("rejects unusable key responses %#", async (body, code) => {
  const result = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.check),
      Effect.flip,
      Effect.provide(http(async () => new Response(body))),
    ),
  );
  expect(result.code).toBe(code);
  expect(JSON.stringify(result)).not.toContain("test-secret-key");
});

it("times out and cancels pending transport work", async () => {
  let signal: AbortSignal | undefined;
  await Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const adapter = yield* runtime.pipe(
        Effect.provide(
          http(async (_url, init) => {
            signal = init?.signal ?? undefined;
            Effect.runSync(Deferred.succeed(started, undefined));
            return new Promise<Response>(() => {});
          }),
        ),
      );
      const pending = yield* adapter.check.pipe(Effect.flip, Effect.forkChild);
      yield* Deferred.await(started);
      yield* TestClock.adjust("15 seconds");
      expect(yield* Fiber.join(pending)).toMatchObject({ code: "NetworkUnavailable" });
      expect(signal?.aborted).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});

it("reports a connection failure while reading the response without exposing transport errors", async () => {
  const result = await Effect.runPromise(
    runtime.pipe(
      Effect.flatMap((adapter) => adapter.check),
      Effect.flip,
      Effect.provide(
        http(
          async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(new Error("test-secret-key"));
                },
              }),
            ),
        ),
      ),
    ),
  );
  expect(result.code).toBe("NetworkUnavailable");
  expect(JSON.stringify(result)).not.toContain("test-secret-key");
});
