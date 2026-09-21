import { Workspace, WorkspaceError } from "@stargeist/domain/workspaces";
import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

export const WorkspaceControlRpcs = RpcGroup.make(
  Rpc.make("register", {
    payload: { path: Schema.String },
    success: Workspace,
    error: WorkspaceError,
  }),
);
