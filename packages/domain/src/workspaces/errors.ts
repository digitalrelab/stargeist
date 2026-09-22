import { Schema } from "effect";

export class WorkspaceError extends Schema.Error<WorkspaceError>("WorkspaceError")({
  _tag: Schema.tag("WorkspaceError"),
  code: Schema.Literals([
    "NotFound",
    "BackendUnavailable",
    "FolderPickerUnavailable",
    "FolderUnavailable",
    "StorageUnavailable",
    "InvalidWorkspace",
    "WorkspaceChanged",
    "RootConflict",
    "ListingExpired",
    "IdentityUnavailable",
  ]),
  message: Schema.String,
}) {}
