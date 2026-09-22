import { Schema } from "effect";

export class DirectoryError extends Schema.Error<DirectoryError>("DirectoryError")({
  _tag: Schema.tag("DirectoryError"),
  code: Schema.Literals(["FolderUnavailable", "StorageUnavailable", "DirectorySessionExpired"]),
  message: Schema.String,
}) {}
