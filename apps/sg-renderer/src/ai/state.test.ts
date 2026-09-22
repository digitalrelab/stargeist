import {
  ProviderConnectionError,
  type ProviderConnection,
  type ProviderModelCatalog,
} from "@stargeist/ai";
import { AgentModelPreferenceError } from "@stargeist/domain";
import { Deferred, Effect, Redacted } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { expect, it, onTestFinished, vi } from "vite-plus/test";
import type { AgentModelsClient, AIProviderConnectionsClient } from "./client";
import { createAIState } from "./state";

const provider: ProviderConnection = {
  providerId: "example",
  displayName: "Example provider",
  state: { status: "notConfigured" },
};
const saved: ProviderConnection = {
  ...provider,
  state: { status: "configured", summary: "••••1234", lastValidatedAt: 1000 },
};
const agentModels: AgentModelsClient = {
  list: Effect.succeed([]),
  getDefault: Effect.succeed(null),
  setDefault: () => Effect.void,
};

function registry() {
  const value = AtomRegistry.make();
  onTestFinished(() => value.dispose());
  return value;
}

function catalogState(list: AgentModelsClient["list"]) {
  return createAIState(
    {
      list: Effect.succeed([]),
      configure: () => Effect.die("Unexpected configuration"),
      check: () => Effect.die("Unexpected health check"),
      remove: () => Effect.die("Unexpected removal"),
    },
    { ...agentModels, list },
  );
}

it("keeps prefetched AI settings data warm between route subscriptions", async () => {
  const store = registry();
  let connectionLists = 0;
  let modelLists = 0;
  let defaultModelReads = 0;
  const state = createAIState(
    {
      list: Effect.sync(() => {
        connectionLists += 1;
        return [provider];
      }),
      configure: () => Effect.die("Unexpected configuration"),
      check: () => Effect.die("Unexpected health check"),
      remove: () => Effect.die("Unexpected removal"),
    },
    {
      list: Effect.sync(() => {
        modelLists += 1;
        return [];
      }),
      getDefault: Effect.sync(() => {
        defaultModelReads += 1;
        return null;
      }),
      setDefault: () => Effect.die("Unexpected preference update"),
    },
  );

  await Effect.runPromise(
    Effect.gen(function* () {
      yield* AtomRegistry.getResult(store, state.providerConnections.list, {
        suspendOnWaiting: true,
      });
      yield* AtomRegistry.getResult(store, state.agentModels.catalogs, {
        suspendOnWaiting: true,
      });
      yield* AtomRegistry.getResult(store, state.agentModels.defaultModel, {
        suspendOnWaiting: true,
      });
      yield* Effect.yieldNow;

      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([
        provider,
      ]);
      expect(yield* AtomRegistry.getResult(store, state.agentModels.catalogs)).toEqual([]);
      expect(yield* AtomRegistry.getResult(store, state.agentModels.defaultModel)).toBeNull();
      expect({ connectionLists, modelLists, defaultModelReads }).toEqual({
        connectionLists: 1,
        modelLists: 1,
        defaultModelReads: 1,
      });
    }),
  );
});

it("revalidates a stale model catalog when settings are revisited", async () => {
  const store = registry();
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
  onTestFinished(() => now.mockRestore());
  let modelLists = 0;
  const state = catalogState(
    Effect.sync(() => {
      modelLists += 1;
      return [];
    }),
  );

  const firstVisit = store.mount(state.agentModels.catalogs);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  firstVisit();
  await Effect.runPromise(Effect.yieldNow);

  now.mockReturnValue(1_000 + 4 * 60_000);
  const freshVisit = store.mount(state.agentModels.catalogs);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  expect(modelLists).toBe(1);
  freshVisit();
  await Effect.runPromise(Effect.yieldNow);

  now.mockReturnValue(1_000 + 6 * 60_000);
  const staleVisit = store.mount(state.agentModels.catalogs);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  expect(modelLists).toBe(2);
  staleVisit();
});

it("refreshes an open model catalog without polling after leaving settings", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  const store = registry();
  let modelLists = 0;
  const state = catalogState(
    Effect.sync(() => {
      modelLists += 1;
      return [];
    }),
  );

  const leaveSettings = store.mount(state.agentModels.catalogs);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  expect(modelLists).toBe(1);

  await vi.advanceTimersByTimeAsync(5 * 60_000);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  expect(modelLists).toBe(2);

  leaveSettings();
  await Effect.runPromise(Effect.yieldNow);
  await vi.advanceTimersByTimeAsync(5 * 60_000);
  expect(modelLists).toBe(2);
});

it("keeps the cached catalog available during revalidation", async () => {
  const store = registry();
  const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
  onTestFinished(() => now.mockRestore());
  const refreshed = Effect.runSync(Deferred.make<ReadonlyArray<ProviderModelCatalog>>());
  let modelLists = 0;
  const state = catalogState(
    Effect.suspend(() => {
      modelLists += 1;
      if (modelLists === 1) return Effect.succeed([]);
      return Deferred.await(refreshed);
    }),
  );

  const firstVisit = store.mount(state.agentModels.catalogs);
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  firstVisit();
  await Effect.runPromise(Effect.yieldNow);

  now.mockReturnValue(1_000 + 6 * 60_000);
  const staleVisit = store.mount(state.agentModels.catalogs);
  const cached = await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs).pipe(Effect.timeout("1 second")),
  );
  expect(cached).toEqual([]);
  expect(modelLists).toBe(2);
  await Effect.runPromise(Deferred.succeed(refreshed, []));
  await Effect.runPromise(
    AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true }),
  );
  staleVisit();
});

it("refreshes saved connection summaries after configuring and removing a key", async () => {
  const store = registry();
  let current = provider;
  const client: AIProviderConnectionsClient = {
    list: Effect.sync(() => [current]),
    configure: (input) =>
      Effect.sync(() => {
        expect(input.providerId).toBe("example");
        expect(Redacted.value(input.configuration)).toEqual({ key: "secret-1234" });
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
  let modelLists = 0;
  const state = createAIState(client, {
    ...agentModels,
    list: Effect.sync(() => {
      modelLists += 1;
      return [];
    }),
  });
  const operation = state.providerConnections.operation("example");
  store.mount(state.providerConnections.list);
  store.mount(state.agentModels.catalogs);
  store.mount(operation);
  const configuration = Redacted.make({ key: "secret-1234" });
  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([
        provider,
      ]);
      expect(yield* AtomRegistry.getResult(store, state.agentModels.catalogs)).toEqual([]);
      expect(modelLists).toBe(1);
      store.set(operation, { type: "configure", configuration });
      expect(yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true })).toBe(
        "configure",
      );
      expect(
        yield* AtomRegistry.getResult(store, state.providerConnections.list, {
          suspendOnWaiting: true,
        }),
      ).toEqual([saved]);
      expect(
        yield* AtomRegistry.getResult(store, state.agentModels.catalogs, {
          suspendOnWaiting: true,
        }),
      ).toEqual([]);
      expect(modelLists).toBe(2);
      expect(() => Redacted.value(configuration)).toThrow();
      store.set(operation, { type: "remove" });
      yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true });
      expect(
        yield* AtomRegistry.getResult(store, state.providerConnections.list, {
          suspendOnWaiting: true,
        }),
      ).toEqual([provider]);
      yield* AtomRegistry.getResult(store, state.agentModels.catalogs, { suspendOnWaiting: true });
      expect(modelLists).toBe(3);
    }),
  );
});

it("persists, refreshes, and replaces the default agent model", async () => {
  const store = registry();
  let current = null as { providerId: string; modelId: string } | null;
  let fail = false;
  const failure = new AgentModelPreferenceError({
    message: "Cannot save preference.",
  });
  const state = createAIState(
    {
      list: Effect.succeed([]),
      configure: () => Effect.die("Unexpected configuration"),
      check: () => Effect.die("Unexpected check"),
      remove: () => Effect.die("Unexpected removal"),
    },
    {
      list: Effect.succeed([]),
      getDefault: Effect.sync(() => current),
      setDefault: (model) => {
        if (fail) return Effect.fail(failure);
        return Effect.sync(() => {
          current = model;
        });
      },
    },
  );
  store.mount(state.agentModels.defaultModel);
  store.mount(state.agentModels.updateDefaultModel);
  const selected = { providerId: "openrouter", modelId: "publisher/model" };
  const replacement = { providerId: "openrouter", modelId: "publisher/replacement" };

  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.agentModels.defaultModel)).toBeNull();
      store.set(state.agentModels.updateDefaultModel, selected);
      expect(
        yield* AtomRegistry.getResult(store, state.agentModels.updateDefaultModel, {
          suspendOnWaiting: true,
        }),
      ).toEqual(selected);
      expect(
        yield* AtomRegistry.getResult(store, state.agentModels.defaultModel, {
          suspendOnWaiting: true,
        }),
      ).toEqual(selected);
      fail = true;
      store.set(state.agentModels.updateDefaultModel, replacement);
      expect(
        yield* AtomRegistry.getResult(store, state.agentModels.updateDefaultModel, {
          suspendOnWaiting: true,
        }).pipe(Effect.flip),
      ).toBe(failure);
      expect(yield* AtomRegistry.getResult(store, state.agentModels.defaultModel)).toEqual(
        selected,
      );
      fail = false;
      store.set(state.agentModels.updateDefaultModel, replacement);
      yield* AtomRegistry.getResult(store, state.agentModels.updateDefaultModel, {
        suspendOnWaiting: true,
      });
      expect(
        yield* AtomRegistry.getResult(store, state.agentModels.defaultModel, {
          suspendOnWaiting: true,
        }),
      ).toEqual(replacement);
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
  const state = createAIState(
    {
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
    },
    agentModels,
  );
  const health = state.providerConnections.healthCheck("example");
  store.mount(state.providerConnections.list);
  store.mount(health);

  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([saved]);
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
  const state = createAIState(
    {
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
    },
    agentModels,
  );
  const health = state.providerConnections.healthCheck("example");
  const operation = state.providerConnections.operation("example");
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
  const state = createAIState(
    {
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
    },
    agentModels,
  );
  const operation = state.providerConnections.operation("example");
  store.mount(state.providerConnections.list);
  store.mount(operation);
  const rejectedConfiguration = Redacted.make({ key: "rejected-key" });
  const pendingConfiguration = Redacted.make({ key: "pending-key" });
  await Effect.runPromise(
    Effect.gen(function* () {
      yield* AtomRegistry.getResult(store, state.providerConnections.list);
      store.set(operation, { type: "configure", configuration: rejectedConfiguration });
      expect(
        yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true }).pipe(
          Effect.flip,
        ),
      ).toEqual(rejected);
      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([saved]);
      expect(() => Redacted.value(rejectedConfiguration)).toThrow();
      pending = true;
      store.set(operation, { type: "configure", configuration: pendingConfiguration });
      yield* Deferred.await(started);
      store.dispose();
      yield* Deferred.await(canceled);
      expect(() => Redacted.value(pendingConfiguration)).toThrow();
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
  const state = createAIState(
    {
      list: Effect.sync(() => [current]),
      configure: () => Effect.die("Unexpected configuration"),
      check: () => Effect.die("Unexpected check"),
      remove: Effect.fnUntraced(function* (providerId) {
        expect(providerId).toBe("example");
        if (unavailable) return yield* failure;
        current = provider;
      }),
    },
    agentModels,
  );
  const operation = state.providerConnections.operation("example");
  store.mount(state.providerConnections.list);
  store.mount(operation);

  await Effect.runPromise(
    Effect.gen(function* () {
      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([saved]);
      store.set(operation, { type: "remove" });
      expect(
        yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true }).pipe(
          Effect.flip,
        ),
      ).toEqual(failure);
      expect(yield* AtomRegistry.getResult(store, state.providerConnections.list)).toEqual([saved]);
      unavailable = false;
      store.set(operation, { type: "remove" });
      expect(yield* AtomRegistry.getResult(store, operation, { suspendOnWaiting: true })).toBe(
        "remove",
      );
      expect(
        yield* AtomRegistry.getResult(store, state.providerConnections.list, {
          suspendOnWaiting: true,
        }),
      ).toEqual([provider]);
    }),
  );
});
