import { Schema } from "effect";
import { File } from "./file";
import { FileKind } from "./kind";

export const FileSnapshot = Schema.Struct({
  ...File.fields,
  name: Schema.String,
  kind: FileKind,
});
export type FileSnapshot = typeof FileSnapshot.Type;
