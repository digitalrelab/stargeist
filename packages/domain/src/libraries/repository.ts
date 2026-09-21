import { Context, type Effect } from "effect";
import type { WorkspaceId } from "../workspaces";
import type { Library, LibraryId, LibrarySource } from "./library";
import type { LibraryError } from "./errors";

export interface LibrarySelection {
  readonly workspaceId: WorkspaceId;
  readonly id: LibraryId;
}

export class LibraryRepository extends Context.Service<
  LibraryRepository,
  {
    readonly list: (
      workspaceId: WorkspaceId,
    ) => Effect.Effect<ReadonlyArray<Library>, LibraryError>;
    readonly get: (selection: LibrarySelection) => Effect.Effect<Library, LibraryError>;
    readonly add: (
      workspaceId: WorkspaceId,
      source: typeof LibrarySource.Type,
      displayName: string,
      now: number,
    ) => Effect.Effect<Library, LibraryError>;
  }
>()("@stargeist/domain/LibraryRepository") {}
