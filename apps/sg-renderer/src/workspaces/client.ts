import type {
  CreatedWorkspace,
  Workspace,
  WorkspaceError,
  WorkspaceId,
  LibraryError,
} from "@stargeist/domain";
import type { Effect } from "effect";
import type { ClientUnavailableError } from "#src/client/index.ts";

export interface WorkspacesClient {
  readonly list: Effect.Effect<ReadonlyArray<Workspace>, WorkspaceError | ClientUnavailableError>;
  readonly get: (
    id: WorkspaceId,
  ) => Effect.Effect<Workspace, WorkspaceError | ClientUnavailableError>;
  readonly createFromFolder: () => Effect.Effect<
    typeof CreatedWorkspace.Type | null,
    WorkspaceError | LibraryError | ClientUnavailableError
  >;
}
