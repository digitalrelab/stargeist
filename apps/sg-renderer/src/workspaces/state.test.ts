import type { WorkspacesClient } from "./client";
import {
  DirectorySessionId,
  makeFileId,
  type DirectoryPage,
  WorkspaceId,
  Workspace,
  WorkspaceError,
  directoryPageSize,
} from "@stargeist/domain";
import { Deferred, Effect, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createWorkspaceState } from "./state";

const workspace = new Workspace({
  id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
  root: "/project",
});

const createClient = (
  handlers: {
    openWorkspace?: () => Effect.Effect<Workspace | null>;
    browse?: WorkspacesClient["browse"];
    readDirectory?: WorkspacesClient["readDirectory"];
  } = {},
): WorkspacesClient => {
  let workspaces: ReadonlyArray<Workspace> = [];
  const openFromFolder = () =>
    (handlers.openWorkspace ?? (() => Effect.succeed(workspace)))().pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          if (result) workspaces = [result];
        }),
      ),
    );
  return {
    list: Effect.sync(() => workspaces),
    openFromFolder,
    initializeFromFolder: openFromFolder,
    reconnectFromFolder: openFromFolder,
    forget: () =>
      Effect.sync(() => {
        workspaces = [];
      }),
    browse: handlers.browse ?? (() => Effect.die("Unexpected directory request")),
    readDirectory: handlers.readDirectory ?? (() => Effect.die("Unexpected directory request")),
  };
};

function createRegistry() {
  const registry = AtomRegistry.make();
  onTestFinished(() => registry.dispose());

  return registry;
}

describe("Workspace state", () => {
  it("leaves a canceled folder choice unchanged and refreshes workspaces after a successful choice", async () => {
    const registry = createRegistry();
    let selection: Workspace | null = null;
    const state = createWorkspaceState(
      createClient({ openWorkspace: () => Effect.sync(() => selection) }),
    );

    const workspaces = state.workspaces;
    const add = state.openWorkspace("open");
    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, workspaces)).toEqual([]);
        registry.set(add, undefined);
        expect(yield* AtomRegistry.getResult(registry, add, { suspendOnWaiting: true })).toBeNull();
        expect(yield* AtomRegistry.getResult(registry, workspaces)).toEqual([]);
        selection = workspace;
        registry.set(add, undefined);
        expect(yield* AtomRegistry.getResult(registry, add, { suspendOnWaiting: true })).toEqual(
          workspace,
        );
        expect(
          yield* AtomRegistry.getResult(registry, workspaces, { suspendOnWaiting: true }),
        ).toEqual([workspace]);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("refreshes the whole detail and closes each directory session on refresh and unsubscribe", async () => {
    const registry = createRegistry();
    const first: DirectoryPage = {
      directorySessionId: Schema.decodeUnknownSync(DirectorySessionId)("first"),
      offset: 0,
      files: Array.from({ length: directoryPageSize }, (_, index) => ({
        name: `file-${index}`,
        id: Effect.runSync(makeFileId),
        type: "file" as const,
        mediaType: null,
      })),
      hasMore: true,
    };
    const second = {
      ...first,
      directorySessionId: Schema.decodeUnknownSync(DirectorySessionId)("second"),
    };
    const renamed = new Workspace({ id: workspace.id, root: "/renamed" });

    const firstClosed = Effect.runSync(Deferred.make<void>());
    const secondClosed = Effect.runSync(Deferred.make<void>());
    let currentWorkspace = workspace;
    let currentPage = first;
    const reads: DirectorySessionId[] = [];
    const state = createWorkspaceState(
      createClient({
        browse: () =>
          Effect.acquireRelease(
            Effect.sync(() => ({ workspace: currentWorkspace, directory: currentPage })),
            ({ directory }) => {
              if (directory.directorySessionId === first.directorySessionId) {
                return Deferred.succeed(firstClosed, undefined);
              }
              return Deferred.succeed(secondClosed, undefined);
            },
          ),
        readDirectory: ({ directorySessionId, offset }) =>
          Effect.sync(() => {
            reads.push(directorySessionId);
            return { directorySessionId, offset, files: [], hasMore: false };
          }),
      }),
    );

    const detail = state.detail(workspace.id);
    const view = Atom.map(detail, (value) => value.view);
    const unsubscribe = registry.mount(detail);

    await Effect.runPromise(
      Effect.gen(function* () {
        const initial = yield* AtomRegistry.getResult(registry, view);
        expect(initial.contents.sessionId).toBe(first.directorySessionId);
        registry.mount(initial.contents.extent);
        expect(yield* AtomRegistry.getResult(registry, initial.contents.pages(0))).toEqual({
          items: first.files,
          next: directoryPageSize,
        });
        yield* AtomRegistry.getResult(registry, initial.contents.pages(directoryPageSize));
        expect(initial.workspace).toEqual(workspace);
        expect(registry.get(detail).canRefresh).toBe(true);

        currentWorkspace = renamed;
        currentPage = second;
        registry.refresh(detail);

        const reopened = yield* AtomRegistry.getResult(registry, view, {
          suspendOnWaiting: true,
        });
        expect(reopened.contents.sessionId).toBe(second.directorySessionId);
        expect(reopened.contents).not.toBe(initial.contents);
        registry.mount(reopened.contents.extent);
        yield* AtomRegistry.getResult(registry, reopened.contents.pages(directoryPageSize));
        expect(reads).toEqual([first.directorySessionId, second.directorySessionId]);
        expect(reopened.workspace).toEqual(renamed);
        yield* Deferred.await(firstClosed);

        unsubscribe();
        yield* Deferred.await(secondClosed);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it.each([
    ["FolderUnavailable", ["retry", "locate"], true],
    ["InvalidWorkspace", ["retry", "locate"], true],
    ["BackendUnavailable", [], false],
  ] as const)("offers actionable recovery for %s", async (code, recovery, canRefresh) => {
    const registry = createRegistry();
    const failure = new WorkspaceError({
      code,
      message: "Workspace unavailable.",
    });

    const state = createWorkspaceState(
      createClient({
        browse: () => Effect.fail(failure),
      }),
    );

    const detail = state.detail(workspace.id);
    registry.mount(detail);

    const error = await Effect.runPromise(
      AtomRegistry.getResult(
        registry,
        Atom.map(detail, (value) => value.view),
      ).pipe(Effect.flip, Effect.timeout("3 seconds")),
    );

    expect(error).toEqual(failure);
    expect(registry.get(detail).recovery).toEqual(recovery);
    expect(registry.get(detail).canRefresh).toBe(canRefresh);
  });

  it("cancels a pending directory request when its detail is no longer observed", async () => {
    const registry = createRegistry();
    const started = Effect.runSync(Deferred.make<void>());
    const canceled = Effect.runSync(Deferred.make<void>());
    const state = createWorkspaceState(
      createClient({
        browse: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Deferred.succeed(canceled, undefined)),
          ),
      }),
    );

    const unsubscribe = registry.mount(state.detail(workspace.id));

    await Effect.runPromise(Deferred.await(started).pipe(Effect.timeout("3 seconds")));
    unsubscribe();
    await Effect.runPromise(Deferred.await(canceled).pipe(Effect.timeout("3 seconds")));
  });
});
