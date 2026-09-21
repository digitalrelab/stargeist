import { Context, type Effect, Schema } from "effect";
import { Library, type LibrarySource } from "../libraries/library";
import type { WorkspaceError } from "./errors";
import { Workspace, type WorkspaceId } from "./workspace";

export const CreatedWorkspace = Schema.Struct({ workspace: Workspace, library: Library });
export interface CreateWorkspace {
  readonly displayName: string;
  readonly source: typeof LibrarySource.Type;
}
export class Workspaces extends Context.Service<
  Workspaces,
  {
    readonly list: Effect.Effect<ReadonlyArray<Workspace>, WorkspaceError>;
    readonly get: (id: WorkspaceId) => Effect.Effect<Workspace, WorkspaceError>;
    readonly create: (
      input: CreateWorkspace,
    ) => Effect.Effect<typeof CreatedWorkspace.Type, WorkspaceError>;
  }
>()("@stargeist/domain/Workspaces") {}
