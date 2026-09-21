import type { DirectoryListingPage } from "@stargeist/domain/filesystem";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import { Effect, type Layer } from "effect";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import type { ClientUnavailableError } from "#src/rpc/index.ts";
import { WorkspacesClient } from "./client";

export type WorkspaceClientLayer = Layer.Layer<WorkspacesClient, ClientUnavailableError>;

export const createWorkspaceState = (layer: WorkspaceClientLayer) => {
  const runtime = Atom.runtime(layer);

  const workspaces = runtime
    .atom(Effect.flatMap(WorkspacesClient, (client) => client.list()))
    .pipe(Atom.keepAlive);

  const createWorkspace = runtime.fn((_arg: void, get) =>
    Effect.gen(function* () {
      const client = yield* WorkspacesClient;
      const workspace = yield* client.create();

      if (workspace) get.refresh(workspaces);

      return workspace;
    }),
  );

  const workspace = Atom.family((id: WorkspaceId) =>
    runtime.atom(Effect.flatMap(WorkspacesClient, (client) => client.get({ id }))),
  );

  const directory = Atom.family((id: WorkspaceId) =>
    runtime
      .atom(
        Effect.gen(function* () {
          const client = yield* WorkspacesClient;

          return yield* Effect.acquireRelease(client.openDirectory({ id }), (page) =>
            client.closeDirectory({ listingId: page.listingId }).pipe(Effect.ignore),
          );
        }),
      )
      .pipe(Atom.setIdleTTL(0)),
  );

  const directoryView = (initial: DirectoryListingPage) => {
    const extent = Atom.make({ count: initial.entries.length, hasMore: initial.hasMore });

    const pages = Atom.family((offset: number) => {
      if (offset === 0) return Atom.make(AsyncResult.success(initial));

      return runtime
        .atom((get) =>
          Effect.gen(function* () {
            const client = yield* WorkspacesClient;
            const page = yield* client.readDirectory({ listingId: initial.listingId, offset });

            const previous = get.once(extent);

            if (offset + page.entries.length >= previous.count) {
              get.set(extent, { count: offset + page.entries.length, hasMore: page.hasMore });
            }

            return page;
          }),
        )
        .pipe(Atom.setIdleTTL(0));
    });

    return { extent, pages };
  };

  return { runtime, workspaces, createWorkspace, workspace, directory, directoryView };
};

export type WorkspaceState = ReturnType<typeof createWorkspaceState>;
export type DirectoryView = ReturnType<WorkspaceState["directoryView"]>;
