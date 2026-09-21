import { ListingId, type DirectoryListingPage } from "@stargeist/domain/filesystem";
import { WorkspaceId } from "@stargeist/domain/workspaces";
import { Library, LibraryId, LibraryError } from "@stargeist/domain/libraries";
import { LibraryRpcs, LibraryDialogRpcs } from "@stargeist/domain/libraries/rpc";
import { Deferred, Effect, Exit, Schema, Scope } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { createLibraryState } from "./state";

const workspace = { id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001") };

const library = new Library({
  id: Schema.decodeUnknownSync(LibraryId)("lib_00000000000000000000000001"),
  workspaceId: workspace.id,
  displayName: "Footage",
  source: { kind: "local-fs", path: "/project" },
  createdAt: 1,
});

const memoryClient = (
  handlers: {
    getLibrary?: () => Effect.Effect<Library>;
    addLibrary?: () => Effect.Effect<Library | null>;
    openDirectory?: () => Effect.Effect<DirectoryListingPage, LibraryError>;
    closeDirectory?: (input: { listingId: ListingId }) => Effect.Effect<void>;
  } = {},
) =>
  Effect.gen(function* () {
    let libraries: ReadonlyArray<Library> = [];
    const contract = LibraryRpcs.merge(LibraryDialogRpcs);
    const client = yield* RpcTest.makeClient(contract).pipe(
      Effect.provide(
        contract.toLayer({
          "libraries.list": ({ workspaceId }) =>
            Effect.sync(() => libraries.filter((item) => item.workspaceId === workspaceId)),
          "libraries.get": handlers.getLibrary ?? (() => Effect.succeed(library)),
          "libraries.add": () =>
            (handlers.addLibrary ?? (() => Effect.succeed(library)))().pipe(
              Effect.tap((created) =>
                Effect.sync(() => {
                  if (created) libraries = [...libraries, created];
                }),
              ),
            ),
          "libraries.openDirectory":
            handlers.openDirectory ?? (() => Effect.die("Unexpected directory request")),
          "libraries.readDirectory": () => Effect.die("Unexpected directory request"),
          "libraries.closeDirectory": handlers.closeDirectory ?? (() => Effect.void),
        }),
      ),
    );

    return {
      list: client["libraries.list"],
      get: client["libraries.get"],
      add: client["libraries.add"],
      openDirectory: client["libraries.openDirectory"],
      readDirectory: client["libraries.readDirectory"],
      closeDirectory: client["libraries.closeDirectory"],
    };
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

describe("Library state", () => {
  it("leaves a canceled folder choice unchanged and refreshes libraries after a successful choice", async () => {
    const registry = createRegistry();
    let selection: Library | null = null;
    const state = createLibraryState(
      await createClient({ addLibrary: () => Effect.sync(() => selection) }),
    );

    const libraries = state.libraries(workspace.id);
    const add = state.addLibrary(workspace.id);
    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, libraries)).toEqual([]);
        registry.set(add, undefined);
        expect(yield* AtomRegistry.getResult(registry, add, { suspendOnWaiting: true })).toBeNull();
        expect(yield* AtomRegistry.getResult(registry, libraries)).toEqual([]);
        selection = library;
        registry.set(add, undefined);
        expect(yield* AtomRegistry.getResult(registry, add, { suspendOnWaiting: true })).toEqual(
          library,
        );
        expect(
          yield* AtomRegistry.getResult(registry, libraries, { suspendOnWaiting: true }),
        ).toEqual([library]);
      }).pipe(Effect.timeout("3 seconds")),
    );
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
    const renamed = new Library({
      id: library.id,
      workspaceId: library.workspaceId,
      source: library.source,
      createdAt: library.createdAt,
      displayName: "Renamed footage",
    });

    const firstClosed = Effect.runSync(Deferred.make<void>());
    const secondClosed = Effect.runSync(Deferred.make<void>());
    let currentLibrary = library;
    let currentListing = first;
    const state = createLibraryState(
      await createClient({
        getLibrary: () => Effect.sync(() => currentLibrary),
        openDirectory: () => Effect.sync(() => currentListing),
        closeDirectory: ({ listingId }) => {
          if (listingId === first.listingId) {
            return Deferred.succeed(firstClosed, undefined).pipe(Effect.asVoid);
          }

          return Deferred.succeed(secondClosed, undefined).pipe(Effect.asVoid);
        },
      }),
    );

    const detail = state.detail(workspace.id)(library.id);
    const listing = Atom.map(detail, (value) => value.listing);
    const unsubscribe = registry.mount(detail);

    await Effect.runPromise(
      Effect.gen(function* () {
        expect(yield* AtomRegistry.getResult(registry, listing)).toEqual(first);
        expect(registry.get(detail).library).toEqual(library);
        expect(registry.get(detail).canRefresh).toBe(true);

        currentLibrary = renamed;
        currentListing = second;
        registry.refresh(detail);

        expect(
          yield* AtomRegistry.getResult(registry, listing, { suspendOnWaiting: true }),
        ).toEqual(second);
        expect(registry.get(detail).library).toEqual(renamed);
        yield* Deferred.await(firstClosed);

        unsubscribe();
        yield* Deferred.await(secondClosed);
      }).pipe(Effect.timeout("3 seconds")),
    );
  });

  it("preserves library metadata and keeps refresh available when its directory fails", async () => {
    const registry = createRegistry();
    const failure = new LibraryError({
      code: "FolderUnavailable",
      message: "The folder is unavailable.",
    });

    const state = createLibraryState(
      await createClient({
        openDirectory: () => Effect.fail(failure),
      }),
    );

    const detail = state.detail(workspace.id)(library.id);
    registry.mount(detail);

    const error = await Effect.runPromise(
      AtomRegistry.getResult(
        registry,
        Atom.map(detail, (value) => value.listing),
      ).pipe(Effect.flip, Effect.timeout("3 seconds")),
    );

    expect(error).toEqual(failure);
    expect(registry.get(detail).library).toEqual(library);
    expect(registry.get(detail).canRefresh).toBe(true);
  });

  it("cancels a pending directory request when its detail is no longer observed", async () => {
    const registry = createRegistry();
    const started = Effect.runSync(Deferred.make<void>());
    const canceled = Effect.runSync(Deferred.make<void>());
    const state = createLibraryState(
      await createClient({
        openDirectory: () =>
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Deferred.succeed(canceled, undefined)),
          ),
      }),
    );

    const unsubscribe = registry.mount(state.detail(workspace.id)(library.id));

    await Effect.runPromise(Deferred.await(started).pipe(Effect.timeout("3 seconds")));
    unsubscribe();
    await Effect.runPromise(Deferred.await(canceled).pipe(Effect.timeout("3 seconds")));
  });
});
