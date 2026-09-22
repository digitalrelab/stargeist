import {
  type DirectoryError,
  type ListingId,
  type WorkspaceId,
  type Workspaces,
  WorkspaceError,
  Files,
} from "@stargeist/domain";
import { WorkspaceStorage, TemporaryStorage } from "@stargeist/storage";
import { Effect, Exit, Scope, Semaphore } from "effect";
import { openListing } from "../filesystem";

const workspaceError = (error: DirectoryError) =>
  new WorkspaceError({ code: error.code, message: error.message });

const expired = () =>
  new WorkspaceError({
    code: "ListingExpired",
    message: "This folder view has expired. Refresh to reopen it.",
  });

type ActiveListing = {
  readonly scope: Scope.Closeable;
  readonly snapshot: Effect.Success<ReturnType<typeof openListing>>;
};

export const makeWorkspaceBrowser = Effect.fnUntraced(function* (
  workspaces: Pick<Workspaces["Service"], "get">,
) {
  const parent = yield* Effect.scope;
  const temporaryStorage = yield* TemporaryStorage;
  const files = yield* Files;
  const lock = yield* Semaphore.make(1);

  let active: ActiveListing | undefined;

  const release = Effect.suspend(() => {
    if (!active) return Effect.void;

    const previous = active;
    active = undefined;

    return Scope.close(previous.scope, Exit.void);
  });

  const browse = Effect.fnUntraced(function* (id: WorkspaceId) {
    const workspace = yield* workspaces.get(id);
    yield* release;

    const scope = yield* Scope.fork(parent);

    return yield* openListing(workspace.root, {
      exclude: new Set([WorkspaceStorage.directoryName]),
    }).pipe(
      Effect.mapError(workspaceError),
      Scope.provide(scope),
      Effect.provideService(TemporaryStorage, temporaryStorage),
      Effect.provideService(Files, files),
      Effect.map((snapshot) => {
        active = { scope, snapshot };

        return { workspace, directory: snapshot.firstPage };
      }),
      Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
    );
  });

  const read = (id: ListingId, offset: number) =>
    Effect.suspend(() => {
      if (active?.snapshot.listingId !== id) return Effect.fail(expired());

      return active.snapshot.read(offset).pipe(Effect.mapError(workspaceError));
    });

  const close = (id: ListingId) =>
    Effect.suspend(() => {
      if (active?.snapshot.listingId !== id) return Effect.void;

      return release;
    });

  return {
    browse: (id: WorkspaceId) =>
      Effect.acquireRelease(
        lock.withPermit(browse(id)),
        ({ directory }) => lock.withPermit(close(directory.listingId)),
        { interruptible: true },
      ),
    read: (id: ListingId, offset: number) => lock.withPermit(read(id, offset)),
  };
});
