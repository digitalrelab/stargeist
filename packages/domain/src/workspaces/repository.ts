import { Context, type Effect, Schema } from "effect";
import { Library, type LibrarySource } from "../libraries";
import type { WorkspaceError } from "./errors";
import { Workspace, type WorkspaceId } from "./workspace";

export const CreatedWorkspace = Schema.Struct({ workspace: Workspace, library: Library });

export class WorkspaceRepository extends Context.Service<
  WorkspaceRepository,
  {
    readonly list: Effect.Effect<ReadonlyArray<Workspace>, WorkspaceError>;
    readonly get: (id: WorkspaceId) => Effect.Effect<Workspace, WorkspaceError>;
    readonly create: (
      displayName: string,
      source: typeof LibrarySource.Type,
      now: number,
    ) => Effect.Effect<typeof CreatedWorkspace.Type, WorkspaceError>;
  }
>()("@stargeist/domain/WorkspaceRepository") {}
