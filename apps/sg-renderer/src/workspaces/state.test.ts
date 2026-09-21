import type { WorkspacesClient } from "./client";
import { Workspace, WorkspaceId, Library, LibraryId } from "@stargeist/domain";
import { Effect, Schema } from "effect";
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

const createClient = (cancel = false): WorkspacesClient => {
  let records: ReadonlyArray<Workspace> = [];
  return {
    list: Effect.sync(() => records),
    get: () => Effect.succeed(workspace),
    createFromFolder: () =>
      Effect.sync(() => {
        if (cancel) return null;
        records = [workspace];
        return { workspace, library };
      }),
  };
};

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());

  return registry;
}

describe("Workspace state", () => {
  it("refreshes the injected client's list without affecting another state in the same registry", async () => {
    const registry = createRegistry();
    const first = createWorkspaceState(createClient());
    const second = createWorkspaceState(createClient());

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

  it("does not create a workspace when the folder picker is canceled", async () => {
    const registry = createRegistry();
    const state = createWorkspaceState(createClient(true));
    registry.set(state.createWorkspace, undefined);
    expect(
      await Effect.runPromise(AtomRegistry.getResult(registry, state.createWorkspace)),
    ).toBeNull();
    expect(await Effect.runPromise(AtomRegistry.getResult(registry, state.workspaces))).toEqual([]);
  });
});
