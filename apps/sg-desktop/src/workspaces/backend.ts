import { Workspaces } from "@stargeist/domain/workspaces/service";
import { WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
import { Effect } from "effect";
import { WorkspaceControlRpcs } from "./control";
import { selectedFolder } from "../libraries";

export { WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
export { WorkspaceControlRpcs } from "./control";

export const workspaceControlHandlers = WorkspaceControlRpcs.toLayer(
  Effect.gen(function* () {
    const workspaces = yield* Workspaces;

    return {
      "workspaces.create": ({ path }) =>
        selectedFolder(path).pipe(
          Effect.flatMap((folder) => workspaces.create(folder.displayName, folder.source)),
        ),
    };
  }),
);

export const workspaceHandlers = WorkspaceRpcs.toLayer(
  Effect.gen(function* () {
    const workspaces = yield* Workspaces;

    return {
      "workspaces.list": () => workspaces.list,
      "workspaces.get": ({ id }) => workspaces.get(id),
    };
  }),
);
