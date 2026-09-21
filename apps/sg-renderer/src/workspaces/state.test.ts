import { ListingId, type DirectoryListingPage } from "@stargeist/domain/filesystem";
import { Workspace, WorkspaceError, WorkspaceId } from "@stargeist/domain/workspaces";
import { WorkspaceDialogRpcs, WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
import { Deferred, Effect, Exit, Schema, Scope } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createWorkspaceState } from "./state";

const workspace = new Workspace({
  id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
  name: "Project",
  rootPath: "/project",
  createdAt: 1,
  openedAt: 1,
});

const memoryClient = (
  handlers: {
    get?: () => Effect.Effect<Workspace>;
    openDirectory?: () => Effect.Effect<DirectoryListingPage, WorkspaceError>;
    closeDirectory?: (input: { listingId: ListingId }) => Effect.Effect<void>;
  } = {},
) =>
  Effect.gen(function* () {
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
          get: handlers.get ?? (() => Effect.succeed(workspace)),
          openDirectory:
            handlers.openDirectory ?? (() => Effect.die("Unexpected directory request")),
          readDirectory: () => Effect.die("Unexpected directory request"),
          closeDirectory: handlers.closeDirectory ?? (() => Effect.void),
        }),
      ),
    );
  });

async function createClient(handlers: Parameters<typeof memoryClient>[0] = {}) {
  const scope = Scope.makeUnsafe();
  onTestFinished(() => Effect.runPromise(Scope.close(scope, Exit.void)));
  return Effect.runPromise(memoryClient(handlers).pipe(Scope.provide(scope)));
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

        expect(created).toEqual(workspace);
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

  it("refreshes the whole detail and closes each listing on refresh and unsubscribe", async () => {
    const registry = createRegistry();
    const first: DirectoryListingPage = {
      listingId: Schema.decodeUnknownSync(ListingId)("first"),
      offset: 0,
      entries: [],
      hasMore: false,
    };
    const second = { ...first, listingId: Schema.decodeUnknownSync(ListingId)("second") };
    const renamed = new Workspace({
      id: workspace.id,
      name: "Renamed project",
      rootPath: workspace.rootPath,
      createdAt: workspace.createdAt,
      openedAt: workspace.openedAt,
    });
    const firstClosed = Effect.runSync(Deferred.make<void>());
    const secondClosed = Effect.runSync(Deferred.make<void>());
    let currentWorkspace = workspace;
    let currentListing = first;
    const state = createWorkspaceState(
      await createClient({
        get: () => Effect.sync(() => currentWorkspace),
        openDirectory: () => Effect.sync(() => currentListing),
        closeDirectory: ({ listingId }) =>
          Deferred.succeed(
            listingId === first.listingId ? firstClosed : secondClosed,
            undefined,
          ).pipe(Effect.asVoid),
      }),
    );
    const detail = state.detail(workspace.id);
    const listing = Atom.map(detail, (value) => value.listing);
    const unsubscribe = registry.mount(detail);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, listing)).toEqual(first);
        expect(registry.get(detail).workspace).toEqual(workspace);
        expect(registry.get(detail).canRefresh).toBe(true);

        currentWorkspace = renamed;
        currentListing = second;
        registry.refresh(detail);

        expect(
          yield* AtomRegistry.getResult(registry, listing, { suspendOnWaiting: true }),
        ).toEqual(second);
        expect(registry.get(detail).workspace).toEqual(renamed);
        yield* Deferred.await(firstClosed);

        unsubscribe();
        yield* Deferred.await(secondClosed);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("preserves workspace metadata and keeps refresh available when its directory fails", async () => {
    const registry = createRegistry();
    const failure = new WorkspaceError({
      code: "FolderUnavailable",
      message: "The folder is unavailable.",
    });
    const state = createWorkspaceState(
      await createClient({
        openDirectory: () => Effect.fail(failure),
      }),
    );
    const detail = state.detail(workspace.id);
    registry.mount(detail);

    const error = await Effect.runPromise(
      AtomRegistry.getResult(
        registry,
        Atom.map(detail, (value) => value.listing),
      ).pipe(Effect.flip, Effect.timeout("3 seconds")),
    );

    expect(error).toEqual(failure);
    expect(registry.get(detail).workspace).toEqual(workspace);
    expect(registry.get(detail).canRefresh).toBe(true);
  });
});
