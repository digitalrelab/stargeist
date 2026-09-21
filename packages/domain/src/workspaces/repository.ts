import { Context, type Effect } from "effect";
import type { WorkspaceError } from "./errors";
import type { Workspace, WorkspaceId } from "./workspace";

export interface SelectedFolder {
  readonly rootPath: string;
  readonly identity: string;
  readonly name: string;
}

export class WorkspaceRepository extends Context.Service<
  WorkspaceRepository,
  {
    readonly list: Effect.Effect<ReadonlyArray<Workspace>, WorkspaceError>;
    readonly get: (id: WorkspaceId) => Effect.Effect<Workspace, WorkspaceError>;
    readonly register: (
      folder: SelectedFolder,
      now: number,
    ) => Effect.Effect<Workspace, WorkspaceError>;
  }
>()("@stargeist/domain/WorkspaceRepository") {}
