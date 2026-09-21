import { Library, LibraryError, WorkspaceId } from "@stargeist/domain";
import { Schema } from "effect";
import { Rpc, RpcGroup, type RpcClient, type RpcClientError } from "effect/unstable/rpc";

export const LibraryControlRpcs = RpcGroup.make(
  Rpc.make("add", {
    payload: { workspaceId: WorkspaceId, path: Schema.String },
    success: Library,
    error: LibraryError,
  }),
).prefix("libraries.");

export type LibraryControlClient = RpcClient.FromGroup<
  typeof LibraryControlRpcs,
  RpcClientError.RpcClientError
>;
