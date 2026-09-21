import { CreatedWorkspace, WorkspaceCreationError } from "@stargeist/domain/workspaces/rpc";
import { Schema } from "effect";
import { Rpc, RpcGroup, type RpcClient, type RpcClientError } from "effect/unstable/rpc";

export const WorkspaceControlRpcs = RpcGroup.make(
  Rpc.make("create", {
    payload: { path: Schema.String },
    success: CreatedWorkspace,
    error: WorkspaceCreationError,
  }),
).prefix("workspaces.");

export type WorkspaceControlClient = RpcClient.FromGroup<
  typeof WorkspaceControlRpcs,
  RpcClientError.RpcClientError
>;
