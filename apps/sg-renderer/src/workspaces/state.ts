import type { WorkspaceId, Workspace } from "@stargeist/domain";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { workspaceRecovery, type WorkspaceRecovery } from "./recovery";
import { createFileListing, type FileListing } from "#src/files/index.ts";
import type { WorkspacesClient } from "./client";

export interface WorkspaceListing {
  readonly workspace: Workspace;
  readonly listing: FileListing;
}

export const createWorkspaceState = (client: WorkspacesClient) => {
  const workspaces = Atom.make(client.list).pipe(Atom.keepAlive);
  const detail = Atom.family((id: WorkspaceId) => {
    const view = Atom.make(
      Effect.suspend(() => client.browse(id)).pipe(
        Effect.map(({ workspace, directory }): WorkspaceListing => ({
          workspace,
          listing: createFileListing(directory, (offset) =>
            client.readDirectory({ listingId: directory.listingId, offset }),
          ),
        })),
      ),
    ).pipe(Atom.setIdleTTL(0));
    return Atom.readable(
      (get) => {
        const result = get(view);
        let recovery: ReadonlyArray<WorkspaceRecovery> = [];
        let canRefresh = !result.waiting;
        if (result._tag === "Failure") {
          recovery = workspaceRecovery(result.cause);
          canRefresh = canRefresh && recovery.includes("retry");
        }
        return { view: result, recovery, canRefresh };
      },
      (refresh) => refresh(view),
    ).pipe(Atom.setIdleTTL(0));
  });

  const openWorkspace = Atom.family((mode: "open" | "initialize") =>
    Atom.fn((_arg: void, get) =>
      Effect.gen(function* () {
        let opened;
        if (mode === "initialize") opened = yield* client.initializeFromFolder();
        else opened = yield* client.openFromFolder();
        if (opened) {
          get.refresh(workspaces);
          get.refresh(detail(opened.id));
        }
        return opened;
      }),
    ),
  );
  const reconnectWorkspace = Atom.family((id: WorkspaceId) =>
    Atom.fn((_arg: void, get) =>
      Effect.gen(function* () {
        const opened = yield* client.reconnectFromFolder(id);
        if (opened) {
          get.refresh(workspaces);
          get.refresh(detail(id));
        }
        return opened;
      }),
    ),
  );
  const forgetWorkspace = Atom.fn((id: WorkspaceId, get) =>
    Effect.gen(function* () {
      yield* client.forget(id);
      get.refresh(workspaces);
      get.refresh(detail(id));
    }),
  );
  return { workspaces, openWorkspace, reconnectWorkspace, forgetWorkspace, detail };
};
export type WorkspaceState = ReturnType<typeof createWorkspaceState>;
