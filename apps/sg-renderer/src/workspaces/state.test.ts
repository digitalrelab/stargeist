import { Workspace, WorkspaceId } from "@stargeist/domain/workspaces";
import { Library, LibraryId } from "@stargeist/domain/libraries";
import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
import { Effect, Exit, Schema, Scope } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createWorkspaceState } from "./state";

const workspace = new Workspace({
  id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
  displayName: "Project",
  createdAt: 1,
});

const library = new Library({
  id: Schema.decodeUnknownSync(LibraryId)("lib_00000000000000000000000001"),
  workspaceId: workspace.id,
  displayName: "Project",
  source: { kind: "local-fs", path: "/project" },
  createdAt: 1,
});

const memoryClient = (cancel = false) =>
  Effect.gen(function* () {
    let records: ReadonlyArray<Workspace> = [];
    const contract = WorkspaceRpcs.merge(WorkspaceDialogRpcs);
    const client = yield* RpcTest.makeClient(contract).pipe(
      Effect.provide(
        contract.toLayer({
          "workspaces.list": () => Effect.sync(() => records),
          "workspaces.get": () => Effect.succeed(workspace),
          "workspaces.create": () =>
            Effect.sync(() => {
              if (cancel) return null;

              records = [workspace];

              return { workspace, library };
            }),
        }),
      ),
    );

    return {
      list: client["workspaces.list"],
      get: client["workspaces.get"],
      create: client["workspaces.create"],
    };
  });

async function createClient(cancel = false) {
  const scope = Scope.makeUnsafe();
  onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));

  return Effect.runPromise(memoryClient(cancel).pipe(Scope.provide(scope)));
}

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());

  return registry;
}
describe("Workspace state", () => {
  it("refreshes the injected client's list without affecting another state in the same registry", async () => {
    const registry = createRegistry();
    const first = createWorkspaceState(await createClient());
    const second = createWorkspaceState(await createClient());

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

        expect(created).toEqual({ workspace, library });
        expect(refreshed).toEqual([workspace]);
        expect(yield* AtomRegistry.getResult(registry, second.workspaces)).toEqual([]);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("leaves the application client alive when feature state is disposed", async () => {
    const registry = createRegistry();
    const scope = Scope.makeUnsafe();
    onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));
    let released = false;
    const client = await Effect.runPromise(
      Effect.acquireRelease(memoryClient(), () =>
        Effect.sync(() => {
          released = true;
        }),
      ).pipe(Scope.provide(scope)),
    );

    const state = createWorkspaceState(client);

    await Effect.runPromise(AtomRegistry.getResult(registry, state.workspaces));
    registry.dispose();
    expect(released).toBe(false);
    expect(await Effect.runPromise(client.list())).toEqual([]);

    await Effect.runPromise(Scope.close(scope, Exit.void));
    expect(released).toBe(true);
  });

  it("does not create a workspace when the folder picker is canceled", async () => {
    const registry = createRegistry();
    const state = createWorkspaceState(await createClient(true));
    registry.set(state.createWorkspace, undefined);
    expect(
      await Effect.runPromise(AtomRegistry.getResult(registry, state.createWorkspace)),
    ).toBeNull();
    expect(await Effect.runPromise(AtomRegistry.getResult(registry, state.workspaces))).toEqual([]);
  });
});
