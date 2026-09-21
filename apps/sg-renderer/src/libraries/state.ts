import type { ListingId, WorkspaceId, LibraryId } from "@stargeist/domain";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { canRetryFailure } from "#src/client/index.ts";
import { createFileListing, type FileListing } from "#src/files/index.ts";
import type { LibrariesClient } from "./client";

export interface LibraryListing {
  readonly id: ListingId;
  readonly files: FileListing;
}

export const createLibraryState = (client: LibrariesClient) => {
  const libraries = Atom.family((workspaceId: WorkspaceId) =>
    Atom.make(Effect.suspend(() => client.list(workspaceId))),
  );

  const addLibrary = Atom.family((workspaceId: WorkspaceId) =>
    Atom.fn((_arg: void, get) =>
      Effect.gen(function* () {
        const library = yield* client.addFromFolder(workspaceId);

        if (library) get.refresh(libraries(workspaceId));

        return library;
      }),
    ),
  );

  const detail = Atom.family((workspaceId: WorkspaceId) =>
    Atom.family((id: LibraryId) => {
      const metadata = Atom.make(Effect.suspend(() => client.get({ workspaceId, id })));
      const listing = Atom.make(
        Effect.acquireRelease(
          Effect.suspend(() => client.openDirectory({ workspaceId, id })),
          (page) => client.closeDirectory({ listingId: page.listingId }).pipe(Effect.ignore),
          { interruptible: true },
        ).pipe(
          Effect.map((initial): LibraryListing => ({
            id: initial.listingId,
            files: createFileListing(initial, (offset) =>
              client.readDirectory({ listingId: initial.listingId, offset }),
            ),
          })),
        ),
      ).pipe(Atom.setIdleTTL(0));

      return Atom.readable(
        (get) => {
          const details = get(metadata);
          const entries = get(listing);

          let library;
          let result = entries;

          if (details._tag === "Success") {
            library = details.value;
          }

          if (details._tag === "Failure") {
            result = AsyncResult.failure(details.cause, { waiting: details.waiting });
          }

          return {
            library,
            listing: result,
            canRefresh:
              !details.waiting &&
              !entries.waiting &&
              (details._tag !== "Failure" || canRetryFailure(details.cause)) &&
              (entries._tag !== "Failure" || canRetryFailure(entries.cause)),
          };
        },
        (refresh) => {
          refresh(metadata);
          refresh(listing);
        },
      ).pipe(Atom.setIdleTTL(0));
    }),
  );

  return { libraries, addLibrary, detail };
};

export type LibraryState = ReturnType<typeof createLibraryState>;
