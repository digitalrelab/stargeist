import { LibraryError } from "../libraries";
import { CreatedWorkspace } from "./repository";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { WorkspaceError } from "./errors";
import { Workspace, WorkspaceId } from "./workspace";

export const WorkspaceRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(Workspace), error: WorkspaceError }),
  Rpc.make("get", { payload: { id: WorkspaceId }, success: Workspace, error: WorkspaceError }),
).prefix("workspaces.");

export { CreatedWorkspace } from "./repository";

export const WorkspaceCreationError = Schema.Union([WorkspaceError, LibraryError]);

export const WorkspaceDialogRpcs = RpcGroup.make(
  Rpc.make("create", { success: Schema.NullOr(CreatedWorkspace), error: WorkspaceCreationError }),
).prefix("workspaces.");
