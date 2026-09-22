import * as Id from "@stargeist/std/id";
import { Schema } from "effect";

export const { schema: FileId, generate: makeFileId } = Id.define("fil");
export type FileId = typeof FileId.Type;

export const FileType = Schema.Literals(["file", "folder", "link", "other"]);
export type FileType = typeof FileType.Type;

export const File = Schema.Struct({
  id: FileId,
});
export type File = typeof File.Type;

export const FileReference = Schema.Struct({
  source: Schema.NonEmptyString,
  key: Schema.NonEmptyString,
});
export type FileReference = typeof FileReference.Type;

export const FileSnapshot = Schema.Struct({
  ...File.fields,
  name: Schema.String,
  type: FileType,
  mediaType: Schema.NullOr(Schema.String),
});
export type FileSnapshot = typeof FileSnapshot.Type;
