import type { DirectoryListingPage } from "@stargeist/domain/filesystem";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import type { LibraryId } from "@stargeist/domain/libraries";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { canRetryFailure } from "#src/rpc/index.ts";
import type { LibrariesClient } from "./client";

export const createLibraryState = (client: LibrariesClient) => {
  const libraries = Atom.family((workspaceId: WorkspaceId) =>
    Atom.make(Effect.suspend(() => client.list({ workspaceId }))),
  );

  const addLibrary = Atom.family((workspaceId: WorkspaceId) =>
    Atom.fn((_arg: void, get) =>
      Effect.gen(function* () {
        const library = yield* client.add({ workspaceId });

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

  const directoryView = (initial: DirectoryListingPage) => {
    const extent = Atom.make({ count: initial.entries.length, hasMore: initial.hasMore });

    const pages = Atom.family((offset: number) => {
      if (offset === 0) return Atom.make(AsyncResult.success(initial));

      return Atom.make((get) =>
        Effect.gen(function* () {
          const page = yield* client.readDirectory({ listingId: initial.listingId, offset });

          const previous = get.once(extent);

          if (offset + page.entries.length >= previous.count) {
            get.set(extent, { count: offset + page.entries.length, hasMore: page.hasMore });
          }

          return page;
        }),
      ).pipe(Atom.setIdleTTL(0));
    });

    return { extent, pages };
  };

  return { libraries, addLibrary, detail, directoryView };
};

export type LibraryState = ReturnType<typeof createLibraryState>;

export type DirectoryView = ReturnType<LibraryState["directoryView"]>;
