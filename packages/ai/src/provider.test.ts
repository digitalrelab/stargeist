import { Cause, Context, Effect, Exit, Redacted, Schema } from "effect";
import { expect, it, vi } from "vite-plus/test";
import * as AIProvider from "./provider";
import { ProviderRegistry, registryLayer } from "./registry";

it("validates provider-owned settings, redacts errors, and only runs requested operations", async () => {
  const check = vi.fn(() => Effect.void);
  const models = vi.fn(() => Effect.succeed([]));
  const definition = AIProvider.define({
    id: "custom",
    displayName: "Custom provider",
    configuration: Schema.Struct({
      endpoint: Schema.Literal("https://example.test"),
      token: Schema.Redacted(Schema.NonEmptyString),
    }),
  })(Effect.succeed({ describe: (settings) => settings.endpoint, check, models }));

  await Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* definition.make;
      expect(yield* provider.open(null).pipe(Effect.flip)).toMatchObject({ code: "NotConfigured" });
      const invalid = yield* provider
        .open(Redacted.make({ endpoint: "invalid-secret", token: "private-token" }))
        .pipe(Effect.exit);
      expect(Exit.isFailure(invalid)).toBe(true);
      if (Exit.isFailure(invalid)) {
        expect(Cause.pretty(invalid.cause)).not.toContain("private-token");
        expect(Cause.pretty(invalid.cause)).not.toContain("invalid-secret");
      }
      expect(
        yield* provider
          .open(Redacted.make({ endpoint: "invalid", token: "private-token" }))
          .pipe(Effect.flip),
      ).toMatchObject({ code: "InvalidConfiguration" });
      const runtime = yield* provider.open(
        Redacted.make({
          endpoint: "https://example.test",
          token: "private-token",
          unused: "discarded",
        }),
      );
      expect(runtime.summary).toBe("https://example.test");
      expect(Redacted.value(runtime.configuration)).toEqual({
        endpoint: "https://example.test",
        token: "private-token",
      });
      expect(check).not.toHaveBeenCalled();
      expect(models).not.toHaveBeenCalled();
      yield* runtime.check;
      expect(check).toHaveBeenCalledOnce();
      expect(models).not.toHaveBeenCalled();
      expect(yield* runtime.models).toEqual([]);
      expect(models).toHaveBeenCalledOnce();
    }),
  );
});

it("rejects malformed model descriptors before exposing a provider catalog", async () => {
  const definition = AIProvider.define({
    id: "invalid-catalog",
    displayName: "Invalid catalog",
    configuration: Schema.Null,
  })(
    Effect.succeed({
      describe: () => null,
      check: () => Effect.void,
      models: () =>
        Effect.succeed([
          {
            id: "publisher/model",
            name: "Model",
            publisher: { id: "", name: "Publisher" },
            pricing: null,
            capabilities: {
              toolCalling: true,
              reasoning: false,
              inputModalities: ["text" as const],
              outputModalities: ["text"],
            },
          },
        ]),
    }),
  );
  const error = await Effect.runPromise(
    definition.make.pipe(
      Effect.flatMap((provider) => provider.open(null)),
      Effect.flatMap((runtime) => runtime.models),
      Effect.flip,
    ),
  );
  expect(error.code).toBe("InvalidResponse");
});

class Transport extends Context.Service<Transport, { readonly endpoint: string }>()(
  "TestTransport",
) {}
class StartupError extends Schema.TaggedError<StartupError>()("StartupError", {}) {}
class LocalEndpoint extends Context.Service<LocalEndpoint, string>()("TestLocalEndpoint") {}

it("preserves Effect dependencies, startup errors, and scoped provider resources", async () => {
  const release = vi.fn();
  const definition = AIProvider.define({
    id: "scoped",
    displayName: "Scoped provider",
    configuration: Schema.Null,
  })(
    Effect.gen(function* () {
      const transport = yield* Transport;
      yield* Effect.acquireRelease(Effect.void, () => Effect.sync(release));
      if (!transport.endpoint) return yield* new StartupError();
      return {
        describe: () => transport.endpoint,
        check: () => Effect.void,
        models: () => Effect.succeed([]),
      };
    }),
  );
  const local = AIProvider.define({
    id: "local",
    displayName: "Local",
    configuration: Schema.Null,
  })(
    Effect.gen(function* () {
      const endpoint = yield* LocalEndpoint;
      if (!endpoint) return yield* Effect.fail("Missing local endpoint" as const);
      return {
        describe: () => endpoint,
        check: () => Effect.void,
        models: () => Effect.succeed([]),
      };
    }),
  );
  const registry = registryLayer([definition, local]);
  const connect = Effect.gen(function* () {
    const providers = yield* ProviderRegistry;
    const runtime = yield* (yield* providers.get("scoped")).open(null);
    expect(runtime.summary).toBe("https://example.test");
    expect(release).not.toHaveBeenCalled();
    expect(yield* providers.get("missing").pipe(Effect.flip)).toMatchObject({
      code: "UnknownProvider",
    });
  }).pipe(Effect.provide(registry), Effect.provideService(LocalEndpoint, "http://localhost:9000"));

  await Effect.runPromise(
    connect.pipe(Effect.provideService(Transport, { endpoint: "https://example.test" })),
  );
  expect(release).toHaveBeenCalledTimes(1);
  const error = await Effect.runPromise(
    connect.pipe(Effect.provideService(Transport, { endpoint: "" }), Effect.flip),
  );
  expect(error).toBeInstanceOf(StartupError);
  expect(release).toHaveBeenCalledTimes(2);
});

it("rejects duplicate registrations before acquiring provider resources", async () => {
  const acquire = vi.fn(() => ({
    describe: () => null,
    check: () => Effect.void,
    models: () => Effect.succeed([]),
  }));
  const definition = AIProvider.define({
    id: "duplicate",
    displayName: "Duplicate",
    configuration: Schema.Null,
  })(Effect.sync(acquire));
  const result = await Effect.runPromiseExit(
    ProviderRegistry.pipe(Effect.provide(registryLayer([definition, definition]))),
  );
  expect(Exit.isFailure(result)).toBe(true);
  if (Exit.isFailure(result))
    expect(Cause.pretty(result.cause)).toContain("Duplicate AI provider registration: duplicate");
  expect(acquire).not.toHaveBeenCalled();
});
