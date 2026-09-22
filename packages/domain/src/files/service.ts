import { Context, Schema, type Effect } from "effect";
import { File, FileReference } from "./file";

export class FileError extends Schema.Error<FileError>("FileError")({
  _tag: Schema.tag("FileError"),
  code: Schema.Literals(["StorageUnavailable"]),
  message: Schema.String,
}) {}

export class Files extends Context.Service<
  Files,
  {
    readonly ensure: (
      references: ReadonlyArray<FileReference>,
    ) => Effect.Effect<ReadonlyArray<File>, FileError>;
  }
>()("@stargeist/domain/Files") {}
