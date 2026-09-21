import type { WorkspaceDialogRpcs, WorkspaceRpcs } from "@stargeist/domain/workspaces/rpc";
import { Context } from "effect";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";

export class WorkspacesClient extends Context.Service<
  WorkspacesClient,
  RpcClient.FromGroup<typeof WorkspaceRpcs, RpcClientError.RpcClientError> &
    RpcClient.FromGroup<typeof WorkspaceDialogRpcs, RpcClientError.RpcClientError>
>()("@stargeist/renderer/WorkspacesClient") {}
