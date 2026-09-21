import { Workspace, WorkspaceId } from "@stargeist/domain/workspaces";
import { WorkspaceDialogRpcs, WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
import { Deferred, Effect, Layer, Schema } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { WorkspacesClient } from "./client";
import { createWorkspaceState } from "./state";

const workspace = new Workspace({
  id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
  name: "Project",
  rootPath: "/project",
  createdAt: 1,
  openedAt: 1,
});

const memoryClient = Effect.gen(function* () {
  let records: ReadonlyArray<Workspace> = [];
  const contract = WorkspaceRpcs.merge(WorkspaceDialogRpcs);

  return yield* RpcTest.makeClient(contract).pipe(
    Effect.provide(
      contract.toLayer({
        list: () => Effect.sync(() => records),
        create: () =>
          Effect.sync(() => {
            records = [workspace];
            return workspace;
          }),
        get: () => Effect.succeed(workspace),
        openDirectory: () => Effect.die("Unexpected directory request"),
        readDirectory: () => Effect.die("Unexpected directory request"),
        closeDirectory: () => Effect.void,
      }),
    ),
  );
});

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());
  return registry;
}

describe("Workspace state", () => {
  it("refreshes the injected client's list without affecting another state in the same registry", async () => {
    const registry = createRegistry();
    const first = createWorkspaceState(Layer.effect(WorkspacesClient, memoryClient));
    const second = createWorkspaceState(Layer.effect(WorkspacesClient, memoryClient));
    registry.mount(first.runtime);
    registry.mount(second.runtime);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, first.workspaces)).toEqual([]);
        expect(yield* AtomRegistry.getResult(registry, second.workspaces)).toEqual([]);

        registry.set(first.createWorkspace, undefined);
        const created = yield* AtomRegistry.getResult(registry, first.createWorkspace, {
          suspendOnWaiting: true,
        });
        const refreshed = yield* AtomRegistry.getResult(registry, first.workspaces, {
          suspendOnWaiting: true,
        });

        expect(created).toEqual(workspace);
        expect(refreshed).toEqual([workspace]);
        expect(yield* AtomRegistry.getResult(registry, second.workspaces)).toEqual([]);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("releases the adapter when its registry is disposed", async () => {
    const registry = createRegistry();
    const released = Effect.runSync(Deferred.make<void>());
    const layer = Layer.effect(
      WorkspacesClient,
      Effect.acquireRelease(memoryClient, () => Deferred.succeed(released, undefined)),
    );
    const state = createWorkspaceState(layer);
    registry.mount(state.runtime);

    await Effect.runPromise(AtomRegistry.getResult(registry, state.runtime));
    registry.dispose();

    await Effect.runPromise(Deferred.await(released).pipe(Effect.timeout("3 seconds")));
  });
});
