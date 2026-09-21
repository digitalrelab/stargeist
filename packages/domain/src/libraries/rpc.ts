import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { DirectoryListingPage, ListingId, PageOffset } from "../filesystem";
import { WorkspaceId } from "../workspaces";
import { LibraryError } from "./errors";
import { Library, LibraryId } from "./library";

const selection = { workspaceId: WorkspaceId, id: LibraryId };

export const LibraryRpcs = RpcGroup.make(
  Rpc.make("list", {
    payload: { workspaceId: WorkspaceId },
    success: Schema.Array(Library),
    error: LibraryError,
  }),
  Rpc.make("get", { payload: selection, success: Library, error: LibraryError }),
  Rpc.make("openDirectory", {
    payload: selection,
    success: DirectoryListingPage,
    error: LibraryError,
  }),
  Rpc.make("readDirectory", {
    payload: { listingId: ListingId, offset: PageOffset },
    success: DirectoryListingPage,
    error: LibraryError,
  }),
  Rpc.make("closeDirectory", { payload: { listingId: ListingId }, success: Schema.Void }),
).prefix("libraries.");

export const LibraryDialogRpcs = RpcGroup.make(
  Rpc.make("add", {
    payload: { workspaceId: WorkspaceId },
    success: Schema.NullOr(Library),
    error: LibraryError,
  }),
).prefix("libraries.");
