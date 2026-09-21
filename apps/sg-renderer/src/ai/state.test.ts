import { ProviderConnectionError, type ProviderConnection } from "@stargeist/domain/ai";
import { Deferred, Effect, Redacted } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished } from "vite-plus/test";
import type { AIProviderConnectionsClient } from "./client";
import { createAIProviderConnectionsState } from "./state";

const provider: ProviderConnection = {
  providerId: "example",
  displayName: "Example provider",
  credentialKind: "apiKey",
  state: { status: "notConfigured" },
};
const saved: ProviderConnection = {
  ...provider,
  state: { status: "configured", keyHint: "••••1234", lastValidatedAt: 1000 },
};

function registry() {
  const value = AtomRegistry.make();
  onTestFinished(() => value.dispose());
  return value;
}

it("refreshes saved connection summaries after configuring, checking, and removing a key", async () => {
  const store = registry();
  let current = provider;
  const client: AIProviderConnectionsClient = {
    list: Effect.sync(() => [current]),
    configure: (input) =>
      Effect.sync(() => {
        expect(input.providerId).toBe("example");
        expect(Redacted.value(input.credential.key)).toBe("secret-1234");
        current = saved;
        return current;
      }),
    check: (id) =>
      Effect.sync(() => {
        expect(id).toBe("example");
        current = {
          ...saved,
          state: { status: "configured", keyHint: "••••1234", lastValidatedAt: 2000 },
        };
        return current;
      }),
    remove: (id) =>
      Effect.sync(() => {
        expect(id).toBe("example");
        current = provider;
      }),
  };
  const state = createAIProviderConnectionsState(client);
  const operation = state.operation("example");
  store.mount(state.connections);
  store.mount(operation);
  const key = Redacted.make("secret-1234");
  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.connections)).toEqual([provider]);
      store.set(operation, { type: "configure", credential: { kind: "apiKey", key } });
      expect(yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true })).toBe(
        "configure",
      );
      expect(
        yield* AtomRegistry.getResult(store, state.connections, { suspendOnWaiting: true }),
      ).toEqual([saved]);
      expect(() => Redacted.value(key)).toThrow();
      store.set(operation, { type: "check" });
      yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true });
      expect(
        (yield* AtomRegistry.getResult(store, state.connections, { suspendOnWaiting: true }))[0]
          ?.state,
      ).toEqual({
        status: "configured",
        keyHint: "••••1234",
        lastValidatedAt: 2000,
      });
      store.set(operation, { type: "remove" });
      yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true });
      expect(
        yield* AtomRegistry.getResult(store, state.connections, { suspendOnWaiting: true }),
      ).toEqual([provider]);
    }),
  );
});

it("preserves the saved summary after rejected replacement and clears submitted secrets on failure and cancellation", async () => {
  const store = registry();
  const rejected = new ProviderConnectionError({
    code: "InvalidCredential",
    message: "Invalid key.",
  });
  const started = Effect.runSync(Deferred.make<void>());
  const canceled = Effect.runSync(Deferred.make<void>());
  let pending = false;
  const state = createAIProviderConnectionsState({
    list: Effect.succeed([saved]),
    configure: () =>
      Effect.suspend(() => {
        if (pending)
          return Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Deferred.succeed(canceled, undefined)),
          );
        return Effect.fail(rejected);
      }),
    check: () => Effect.die("Unexpected check"),
    remove: () => Effect.die("Unexpected removal"),
  });
  const operation = state.operation("example");
  store.mount(state.connections);
  store.mount(operation);
  const rejectedKey = Redacted.make("rejected-key");
  const pendingKey = Redacted.make("pending-key");
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* AtomRegistry.getResult(store, state.connections);
      store.set(operation, { type: "configure", credential: { kind: "apiKey", key: rejectedKey } });
      expect(
        yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true }).pipe(
          Effect.flip,
        ),
      ).toEqual(rejected);
      expect(yield* AtomRegistry.getResult(store, state.connections)).toEqual([saved]);
      expect(() => Redacted.value(rejectedKey)).toThrow();
      pending = true;
      store.set(operation, { type: "configure", credential: { kind: "apiKey", key: pendingKey } });
      yield* Deferred.await(started);
      store.dispose();
      yield* Deferred.await(canceled);
      expect(() => Redacted.value(pendingKey)).toThrow();
    }).pipe(Effect.timeout("3 seconds")),
  );
});
