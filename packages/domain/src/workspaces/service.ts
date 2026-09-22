import { Context, type Effect } from "effect";
import type { WorkspaceError } from "./errors";
import type { Workspace, WorkspaceId } from "./workspace";

export class Workspaces extends Context.Service<
  Workspaces,
  {
    readonly list: Effect.Effect<ReadonlyArray<Workspace>, WorkspaceError>;
    readonly get: (id: WorkspaceId) => Effect.Effect<Workspace, WorkspaceError>;
    readonly open: (path: string) => Effect.Effect<Workspace, WorkspaceError>;
    readonly initialize: (path: string) => Effect.Effect<Workspace, WorkspaceError>;
    readonly reconnect: (id: WorkspaceId, path: string) => Effect.Effect<Workspace, WorkspaceError>;
    readonly forget: (id: WorkspaceId) => Effect.Effect<void, WorkspaceError>;
  }
>()("@stargeist/domain/Workspaces") {}
