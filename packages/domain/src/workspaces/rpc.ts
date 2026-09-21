import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { DirectoryListingPage, ListingId, PageOffset } from "../filesystem";
import { WorkspaceError } from "./errors";
import { Workspace, WorkspaceId } from "./workspace";

export const WorkspaceRpcs = RpcGroup.make(
  Rpc.make("list", { success: Schema.Array(Workspace), error: WorkspaceError }),
  Rpc.make("get", { payload: { id: WorkspaceId }, success: Workspace, error: WorkspaceError }),
  Rpc.make("openDirectory", {
    payload: { id: WorkspaceId },
    success: DirectoryListingPage,
    error: WorkspaceError,
  }),
  Rpc.make("readDirectory", {
    payload: { listingId: ListingId, offset: PageOffset },
    success: DirectoryListingPage,
    error: WorkspaceError,
  }),
  Rpc.make("closeDirectory", { payload: { listingId: ListingId }, success: Schema.Void }),
);

export const WorkspaceDialogRpcs = RpcGroup.make(
  Rpc.make("create", { success: Schema.NullOr(Workspace), error: WorkspaceError }),
);
