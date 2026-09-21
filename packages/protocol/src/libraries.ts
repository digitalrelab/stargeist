import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import {
  DirectoryListingPage,
  ListingId,
  PageOffset,
  WorkspaceId,
  LibraryError,
  Library,
  LibraryId,
} from "@stargeist/domain";

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
  Rpc.make("addFromFolder", {
    payload: { workspaceId: WorkspaceId },
    success: Schema.NullOr(Library),
    error: LibraryError,
  }),
).prefix("libraries.");
