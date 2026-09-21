import { Context, type Effect } from "effect";
import type { WorkspaceId } from "../workspaces/workspace";
import type { Library, LibraryId, LibrarySource } from "./library";
import type { LibraryError } from "./errors";

export interface LibrarySelection {
  readonly workspaceId: WorkspaceId;
  readonly id: LibraryId;
}
export interface AddLibrary {
  readonly workspaceId: WorkspaceId;
  readonly source: typeof LibrarySource.Type;
  readonly displayName: string;
}
export class Libraries extends Context.Service<
  Libraries,
  {
    readonly list: (
      workspaceId: WorkspaceId,
    ) => Effect.Effect<ReadonlyArray<Library>, LibraryError>;
    readonly get: (selection: LibrarySelection) => Effect.Effect<Library, LibraryError>;
    readonly add: (input: AddLibrary) => Effect.Effect<Library, LibraryError>;
  }
>()("@stargeist/domain/Libraries") {}
