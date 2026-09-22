import { Context, Schema, type Effect } from "effect";
import { File, FileReference } from "./file";
import type { FileMetadata } from "./metadata";

export class FileError extends Schema.Error<FileError>("FileError")({
  _tag: Schema.tag("FileError"),
  code: Schema.Literals(["StorageUnavailable"]),
  message: Schema.String,
}) {}

export class Files extends Context.Service<
  Files,
  {
    readonly metadata: FileMetadata;
    readonly ensure: (
      references: ReadonlyArray<FileReference>,
    ) => Effect.Effect<ReadonlyArray<File>, FileError>;
  }
>()("@stargeist/domain/Files") {}
