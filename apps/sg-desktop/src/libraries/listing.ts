import type { DirectoryError, ListingId } from "@stargeist/domain/filesystem";
import { LibraryError } from "@stargeist/domain/libraries";
import { Effect, Exit, Scope, Semaphore } from "effect";
import { openListing } from "../filesystem";
import { AppDirectories } from "../storage";

const libraryError = (error: DirectoryError) =>
  new LibraryError({ code: error.code, message: error.message });

const expired = () =>
  new LibraryError({
    code: "ListingExpired",
    message: "This folder view has expired. Refresh to reopen it.",
  });

type ActiveListing = {
  readonly scope: Scope.Closeable;
  readonly snapshot: Effect.Success<ReturnType<typeof openListing>>;
};

export const makeLibraryListing = Effect.gen(function* () {
  const parent = yield* Effect.scope;
  const appDirectories = yield* AppDirectories;
  const lock = yield* Semaphore.make(1);

  let active: ActiveListing | undefined;

  const release = Effect.suspend(() => {
    if (!active) return Effect.void;

    const previous = active;
    active = undefined;

    return Scope.close(previous.scope, Exit.void);
  });

  const open = Effect.fnUntraced(function* (path: string) {
    yield* release;

    const scope = yield* Scope.fork(parent);

    return yield* openListing(path).pipe(
      Effect.mapError(libraryError),
      Scope.provide(scope),
      Effect.provideService(AppDirectories, appDirectories),
      Effect.map((snapshot) => {
        active = { scope, snapshot };

        return snapshot.firstPage;
      }),
      Effect.onError((cause) => Scope.close(scope, Exit.failCause(cause))),
    );
  });

  const read = (id: ListingId, offset: number) =>
    Effect.suspend(() => {
      if (active?.snapshot.listingId !== id) return Effect.fail(expired());

      return active.snapshot.read(offset).pipe(Effect.mapError(libraryError));
    });

  const close = (id: ListingId) =>
    Effect.suspend(() => {
      if (active?.snapshot.listingId !== id) return Effect.void;

      return release;
    });

  return {
    open: (path: string) => lock.withPermit(open(path)),
    read: (id: ListingId, offset: number) => lock.withPermit(read(id, offset)),
    close: (id: ListingId) => lock.withPermit(close(id)),
  };
});
