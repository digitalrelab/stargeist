import { Workspaces } from "@stargeist/domain/workspaces/service";
import { WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
import { Effect } from "effect";
import { WorkspaceControlRpcs } from "./control";
import { makeWorkspaceListing } from "./listing";
import { selectedFolder } from "./selected-folder";

export { WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
export { WorkspaceControlRpcs } from "./control";

export const workspaceControlHandlers = WorkspaceControlRpcs.toLayer(
  Effect.gen(function* () {
    const workspaces = yield* Workspaces;

    return {
      register: ({ path }) => selectedFolder(path).pipe(Effect.flatMap(workspaces.register)),
    };
  }),
);

export const workspaceHandlers = WorkspaceRpcs.toLayer(
  Effect.gen(function* () {
    const workspaces = yield* Workspaces;
    const directories = yield* makeWorkspaceListing;

    return {
      list: () => workspaces.list,
      get: ({ id }) => workspaces.get(id),
      openDirectory: ({ id }) =>
        workspaces
          .get(id)
          .pipe(Effect.flatMap((workspace) => directories.open(workspace.rootPath))),
      readDirectory: ({ listingId, offset }) => directories.read(listingId, offset),
      closeDirectory: ({ listingId }) => directories.close(listingId),
    };
  }),
);
