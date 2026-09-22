import type { WorkspaceError } from "@stargeist/domain";
import type { Effect } from "effect";

export const workspaceDirectoryName = ".stargeist";

export interface WorkspaceRoot {
  readonly identity: string;
  readonly root: string;
  readonly createdAt: number;
}

export interface WorkspaceRoots {
  readonly discover: (path: string) => Effect.Effect<WorkspaceRoot | null, WorkspaceError>;
  readonly initialize: (path: string) => Effect.Effect<WorkspaceRoot, WorkspaceError>;
  readonly read: (root: string) => Effect.Effect<WorkspaceRoot, WorkspaceError>;
}
