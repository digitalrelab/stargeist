import * as Id from "@stargeist/std/id";
import { Schema } from "effect";

export const { schema: FileId, generate: makeFileId } = Id.define("fil");
export type FileId = typeof FileId.Type;

export const FileType = Schema.Literals(["file", "folder", "link", "other"]);
export type FileType = typeof FileType.Type;

export const File = Schema.Struct({
  id: FileId,
  name: Schema.String,
  type: FileType,
  mediaType: Schema.NullOr(Schema.String),
});
export type File = typeof File.Type;
