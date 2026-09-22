import type {
  Workspace,
  WorkspaceView,
  WorkspaceId,
  WorkspaceError,
  DirectoryListingPage,
  ListingId,
} from "@stargeist/domain";
import type { Effect, Scope } from "effect";
import type { ClientUnavailableError } from "#src/client/index.ts";

type Failure = WorkspaceError | ClientUnavailableError;
export interface WorkspacesClient {
  readonly list: Effect.Effect<ReadonlyArray<Workspace>, Failure>;
  readonly openFromFolder: () => Effect.Effect<Workspace | null, Failure>;
  readonly initializeFromFolder: () => Effect.Effect<Workspace | null, Failure>;
  readonly reconnectFromFolder: (id: WorkspaceId) => Effect.Effect<Workspace | null, Failure>;
  readonly forget: (id: WorkspaceId) => Effect.Effect<void, Failure>;
  readonly browse: (id: WorkspaceId) => Effect.Effect<WorkspaceView, Failure, Scope.Scope>;
  readonly readDirectory: (input: {
    readonly listingId: ListingId;
    readonly offset: number;
  }) => Effect.Effect<DirectoryListingPage, Failure>;
}
