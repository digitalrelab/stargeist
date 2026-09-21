import type {
  Library,
  LibraryError,
  LibrarySelection,
  WorkspaceId,
  DirectoryListingPage,
  ListingId,
} from "@stargeist/domain";
import type { Effect } from "effect";
import type { ClientUnavailableError } from "#src/client/index.ts";

type Failure = LibraryError | ClientUnavailableError;
export interface LibrariesClient {
  readonly list: (workspaceId: WorkspaceId) => Effect.Effect<ReadonlyArray<Library>, Failure>;
  readonly get: (selection: LibrarySelection) => Effect.Effect<Library, Failure>;
  readonly addFromFolder: (workspaceId: WorkspaceId) => Effect.Effect<Library | null, Failure>;
  readonly openDirectory: (
    selection: LibrarySelection,
  ) => Effect.Effect<DirectoryListingPage, Failure>;
  readonly readDirectory: (input: {
    readonly listingId: ListingId;
    readonly offset: number;
  }) => Effect.Effect<DirectoryListingPage, Failure>;
  readonly closeDirectory: (input: {
    readonly listingId: ListingId;
  }) => Effect.Effect<void, ClientUnavailableError>;
}
