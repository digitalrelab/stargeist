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
      return ["retry", "locate"];
    case "WorkspaceChanged":
      return ["locate", "open"];
    case "RootConflict":
      return ["open"];
    case "BackendUnavailable":
    case "UnsupportedFormat":
      return [];
    case "InvalidWorkspace":
    case "FolderPickerUnavailable":
    case "StorageUnavailable":
    case "ListingExpired":
      return ["retry"];
  }
}
