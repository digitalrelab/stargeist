import type { DirectoryListingPage } from "@stargeist/domain/filesystem";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import { Effect } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { canRetryFailure } from "#src/rpc/index.ts";
import type { WorkspacesClient } from "./client";

export const createWorkspaceState = (client: WorkspacesClient["Service"]) => {
  const workspaces = Atom.make(Effect.suspend(() => client.list())).pipe(Atom.keepAlive);

  const createWorkspace = Atom.fn((_arg: void, get) =>
    Effect.gen(function* () {
      const workspace = yield* client.create();

      if (workspace) get.refresh(workspaces);

      return workspace;
    }),
  );

  const detail = Atom.family((id: WorkspaceId) => {
    const metadata = Atom.make(Effect.suspend(() => client.get({ id })));
    const listing = Atom.make(
      Effect.acquireRelease(
        Effect.suspend(() => client.openDirectory({ id })),
        (page) => client.closeDirectory({ listingId: page.listingId }).pipe(Effect.ignore),
      ),
    ).pipe(Atom.setIdleTTL(0));

    return Atom.readable(
      (get) => {
        const details = get(metadata);
        const entries = get(listing);

        return {
          workspace: details._tag === "Success" ? details.value : undefined,
          listing:
            details._tag === "Failure"
              ? AsyncResult.failure<
                  DirectoryListingPage,
                  AsyncResult.AsyncResult.Failure<typeof details>
                >(details.cause, {
                  waiting: details.waiting,
                })
              : entries,
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
  });

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

  return { workspaces, createWorkspace, detail, directoryView };
};

export type WorkspaceState = ReturnType<typeof createWorkspaceState>;
export type DirectoryView = ReturnType<WorkspaceState["directoryView"]>;
