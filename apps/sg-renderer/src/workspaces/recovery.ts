import { WorkspaceError } from "@stargeist/domain";
import { Cause } from "effect";
import { ClientUnavailableError } from "#src/client/index.ts";

export type WorkspaceRecovery = "retry" | "locate" | "open";

export function workspaceRecovery(cause: Cause.Cause<unknown>): ReadonlyArray<WorkspaceRecovery> {
  const error = Cause.squash(cause);
  if (error instanceof ClientUnavailableError) return [];
  if (!(error instanceof WorkspaceError)) return ["retry"];
  switch (error.code) {
    case "NotFound":
      return ["open"];
    case "FolderUnavailable":
    case "InvalidWorkspace":
      return ["retry", "locate"];
    case "WorkspaceChanged":
      return ["locate", "open"];
    case "RootConflict":
      return ["open"];
    case "BackendUnavailable":
      return [];
    case "FolderPickerUnavailable":
    case "StorageUnavailable":
    case "DirectorySessionExpired":
      return ["retry"];
  }
}
