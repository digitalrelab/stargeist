import { Deferred, Effect, Fiber, Layer, Redacted } from "effect";
import { TestClock } from "effect/testing";
import { FetchHttpClient } from "effect/unstable/http";
import { expect, it, vi } from "vite-plus/test";
import { makeProviderAdapters } from "./index";
import { makeOpenRouter } from "./openrouter";

const key = { kind: "apiKey" as const, key: Redacted.make("test-secret-key") };
const http = (fetch: typeof globalThis.fetch) =>
  FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)));

it("validates through the key endpoint without generating content, and prevents redirects", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({ data: { is_management_key: false, unexpected: "ignored" } }),
  );
  await Effect.runPromise(
    Effect.gen(function* () {
      const adapters = yield* makeProviderAdapters;
      const adapter = adapters.find((provider) => provider.id === "openrouter");
      expect(adapter).toBeDefined();
      yield* adapter!.validate(key);
    }).pipe(Effect.provideService(FetchHttpClient.Fetch, fetch)),
  );
  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0]!;
  expect(url).toEqual(new URL("https://openrouter.ai/api/v1/key"));
  expect(init?.method).toBe("GET");
  expect(init?.redirect).toBe("error");
  expect(new Headers(init?.headers).get("authorization")).toBe("Bearer test-secret-key");
  expect(init?.body).toBeUndefined();
});

it.each([
  [401, "InvalidCredential"],
  [403, "InvalidCredential"],
  [429, "RateLimited"],
  [503, "ProviderUnavailable"],
  [302, "InvalidResponse"],
])("maps HTTP %s without exposing provider error contents", async (status, code) => {
  const result = await Effect.runPromise(
    makeOpenRouter.pipe(
      Effect.flatMap((adapter) => adapter.validate(key)),
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
    makeOpenRouter.pipe(
      Effect.flatMap((adapter) => adapter.validate(key)),
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
      const adapter = yield* makeOpenRouter.pipe(
        Effect.provide(
          http(async (_url, init) => {
            signal = init?.signal ?? undefined;
            Effect.runSync(Deferred.succeed(started, undefined));
            return new Promise<Response>(() => {});
          }),
        ),
      );
      const pending = yield* adapter.validate(key).pipe(Effect.flip, Effect.forkChild);
      yield* Deferred.await(started);
      yield* TestClock.adjust("15 seconds");
      expect(yield* Fiber.join(pending)).toMatchObject({ code: "NetworkUnavailable" });
      expect(signal?.aborted).toBe(true);
    }).pipe(Effect.provide(TestClock.layer())),
  );
});

it("reports a connection failure while reading the response without exposing transport errors", async () => {
  const result = await Effect.runPromise(
    makeOpenRouter.pipe(
      Effect.flatMap((adapter) => adapter.validate(key)),
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
