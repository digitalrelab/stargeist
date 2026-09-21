import {
  LibraryError,
  CreatedWorkspace,
  WorkspaceError,
  Workspace,
  WorkspaceId,
} from "@stargeist/domain";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const WorkspaceRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(Workspace), error: WorkspaceError }),
  Rpc.make("get", { payload: { id: WorkspaceId }, success: Workspace, error: WorkspaceError }),
).prefix("workspaces.");

export const WorkspaceCreationError = Schema.Union([WorkspaceError, LibraryError]);

export const WorkspaceDialogRpcs = RpcGroup.make(
  Rpc.make("createFromFolder", {
    success: Schema.NullOr(CreatedWorkspace),
    error: WorkspaceCreationError,
  }),
).prefix("workspaces.");
