import { Workspaces } from "@stargeist/domain";
import { WorkspaceRpcs } from "@stargeist/protocol/workspaces";
import { Effect } from "effect";
import { WorkspaceControlRpcs } from "./control";
import { selectedFolder } from "../libraries";

export const workspaceControlHandlers = WorkspaceControlRpcs.toLayer(
  Effect.gen(function* () {
    const workspaces = yield* Workspaces;

    return {
      "workspaces.create": ({ path }) =>
        selectedFolder(path).pipe(Effect.flatMap((folder) => workspaces.create(folder))),
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
