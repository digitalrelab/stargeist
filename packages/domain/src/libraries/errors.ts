import { Schema } from "effect";

export class LibraryError extends Schema.Error<LibraryError>("LibraryError")({
  _tag: Schema.tag("LibraryError"),
  code: Schema.Literals(["NotFound", "FolderUnavailable", "StorageUnavailable", "ListingExpired"]),
  message: Schema.String,
}) {}
