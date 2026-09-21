import type { WorkspaceId } from "@stargeist/domain";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { WorkspacesClient } from "./client";

export const createWorkspaceState = (client: WorkspacesClient) => {
  const workspaces = Atom.make(client.list).pipe(Atom.keepAlive);
  const createWorkspace = Atom.fn((_arg: void, get) =>
    Effect.gen(function* () {
      const created = yield* client.createFromFolder();

      if (created) get.refresh(workspaces);

      return created;
    }),
  );

  const workspace = Atom.family((id: WorkspaceId) =>
    Atom.make(Effect.suspend(() => client.get(id))),
  );

  return { workspaces, createWorkspace, workspace };
};

export type WorkspaceState = ReturnType<typeof createWorkspaceState>;
