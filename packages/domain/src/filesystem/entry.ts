import { Schema } from "effect";

export const FileSystemEntry = Schema.Struct({
  name: Schema.String,
  kind: Schema.Literals(["file", "directory", "symlink", "other"]),
});
export type FileSystemEntry = typeof FileSystemEntry.Type;
