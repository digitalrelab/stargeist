import type { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";

type ReadClient = RpcClient.FromGroup<typeof WorkspaceRpcs, RpcClientError.RpcClientError>;

type DialogClient = RpcClient.FromGroup<typeof WorkspaceDialogRpcs, RpcClientError.RpcClientError>;

export interface WorkspacesClient {
  readonly list: ReadClient["workspaces.list"];
  readonly get: ReadClient["workspaces.get"];
  readonly create: DialogClient["workspaces.create"];
}
