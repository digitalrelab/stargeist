import {
  WorkspaceError,
  Workspace,
  WorkspaceView,
  WorkspaceId,
  DirectoryPage,
  DirectorySessionId,
  PageOffset,
} from "@stargeist/domain";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const WorkspaceRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(Workspace), error: WorkspaceError }),
  Rpc.make("forget", {
    payload: { id: WorkspaceId },
    success: Schema.Void,
    error: WorkspaceError,
  }),
  Rpc.make("browse", {
    payload: { id: WorkspaceId },
    success: WorkspaceView,
    stream: true,
    error: WorkspaceError,
  }),
  Rpc.make("readDirectory", {
    payload: { directorySessionId: DirectorySessionId, offset: PageOffset },
    success: DirectoryPage,
    error: WorkspaceError,
  }),
).prefix("workspaces.");

export const WorkspaceDialogRpcs = RpcGroup.make(
  Rpc.make("openFromFolder", { success: Schema.NullOr(Workspace), error: WorkspaceError }),
  Rpc.make("initializeFromFolder", {
    success: Schema.NullOr(Workspace),
    error: WorkspaceError,
  }),
  Rpc.make("reconnectFromFolder", {
    payload: { id: WorkspaceId },
    success: Schema.NullOr(Workspace),
    error: WorkspaceError,
  }),
).prefix("workspaces.");
