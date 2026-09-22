import { ProviderConnectionError, type ProviderConnection } from "@stargeist/domain";
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

it("refreshes saved connection summaries after configuring and removing a key", async () => {
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
    check: () => Effect.die("Unexpected health check"),
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
      store.set(operation, { type: "remove" });
      yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true });
      expect(
        yield* AtomRegistry.getResult(store, state.connections, { suspendOnWaiting: true }),
      ).toEqual([provider]);
    }),
  );
});

it("tracks connection health independently from saved connection summaries", async () => {
  const store = registry();
  const disconnected = new ProviderConnectionError({
    code: "NetworkUnavailable",
    message: "Cannot reach provider.",
  });
  let available = false;
  let lists = 0;
  const state = createAIProviderConnectionsState({
    list: Effect.sync(() => {
      lists += 1;
      return [saved];
    }),
    configure: () => Effect.die("Unexpected configuration"),
    check: (providerId) => {
      expect(providerId).toBe("example");
      if (available) return Effect.succeed(saved);
      return Effect.fail(disconnected);
    },
    remove: () => Effect.die("Unexpected removal"),
  });
  const health = state.health("example");
  store.mount(state.connections);
  store.mount(health);

  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.connections)).toEqual([saved]);
      store.set(health, undefined);
      expect(
        yield* AtomRegistry.getResult(store, health, { suspendOnWaiting: true }).pipe(Effect.flip),
      ).toEqual(disconnected);
      expect(lists).toBe(1);
      available = true;
      store.set(health, undefined);
      expect(yield* AtomRegistry.getResult(store, health, { suspendOnWaiting: true })).toEqual(
        saved,
      );
      expect(lists).toBe(1);
    }),
  );
});

it("cancels an in-flight health check before changing the connection", async () => {
  const store = registry();
  const started = Effect.runSync(Deferred.make<void>());
  const canceled = Effect.runSync(Deferred.make<void>());
  let removed = false;
  const state = createAIProviderConnectionsState({
    list: Effect.succeed([saved]),
    configure: () => Effect.die("Unexpected configuration"),
    check: () =>
      Deferred.succeed(started, undefined).pipe(
        Effect.andThen(Effect.never),
        Effect.ensuring(Deferred.succeed(canceled, undefined)),
      ),
    remove: () =>
      Deferred.await(canceled).pipe(
        Effect.andThen(
          Effect.sync(() => {
            removed = true;
          }),
        ),
      ),
  });
  const health = state.health("example");
  const operation = state.operation("example");
  store.mount(health);
  store.mount(operation);

  await Effect.runPromise(
    Effect.gen(function* () {
      store.set(health, undefined);
      yield* Deferred.await(started);
      store.set(operation, { type: "remove" });
      expect(yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true })).toBe(
        "remove",
      );
      expect(removed).toBe(true);
    }).pipe(Effect.timeout("3 seconds")),
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

it("retains the saved connection after failed removal and refreshes it after a successful retry", async () => {
  const store = registry();
  const failure = new ProviderConnectionError({
    code: "StorageUnavailable",
    message: "Cannot remove the saved key.",
  });
  let current = saved;
  let unavailable = true;
  const state = createAIProviderConnectionsState({
    list: Effect.sync(() => [current]),
    configure: () => Effect.die("Unexpected configuration"),
    check: () => Effect.die("Unexpected check"),
    remove: Effect.fnUntraced(function* (providerId) {
      expect(providerId).toBe("example");
      if (unavailable) return yield* failure;
      current = provider;
    }),
  });
  const operation = state.operation("example");
  store.mount(state.connections);
  store.mount(operation);

  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.connections)).toEqual([saved]);
      store.set(operation, { type: "remove" });
      expect(
        yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true }).pipe(
          Effect.flip,
        ),
      ).toEqual(failure);
      expect(yield* AtomRegistry.getResult(store, state.connections)).toEqual([saved]);
      unavailable = false;
      store.set(operation, { type: "remove" });
      expect(yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true })).toBe(
        "remove",
      );
      expect(
        yield* AtomRegistry.getResult(store, state.connections, { suspendOnWaiting: true }),
      ).toEqual([provider]);
    }),
  );
});
