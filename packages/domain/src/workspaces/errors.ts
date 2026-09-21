import { Schema } from "effect";

export class WorkspaceError extends Schema.Error<WorkspaceError>("WorkspaceError")({
  _tag: Schema.tag("WorkspaceError"),
  code: Schema.Literals(["NotFound", "FolderUnavailable", "StorageUnavailable", "ListingExpired"]),
  message: Schema.String,
}) {}
