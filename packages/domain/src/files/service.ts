import { Context, Schema, Struct, type Effect } from "effect";
import { File, FileId } from "./file";

export const FileObservation = Schema.Struct({
  source: Schema.NonEmptyString,
  objectKey: Schema.NonEmptyString,
  evidence: Schema.NullOr(Schema.NonEmptyString),
  ...Struct.omit(File.fields, ["id"]),
});
export type FileObservation = typeof FileObservation.Type;

type Identity = Pick<FileObservation, "source" | "objectKey" | "evidence">;

export interface FileIdentityComparison {
  readonly previous: Identity;
  readonly current: Identity;
}

export type FileIdentityVerifier = (
  comparisons: ReadonlyArray<FileIdentityComparison>,
) => Effect.Effect<ReadonlyArray<"same" | "different">, FileError>;

export class FileError extends Schema.Error<FileError>("FileError")({
  _tag: Schema.tag("FileError"),
  code: Schema.Literals(["StorageUnavailable", "IdentityUnavailable", "ObservationExpired"]),
  message: Schema.String,
}) {}

export class Files extends Context.Service<
  Files,
  {
    readonly remember: (
      observations: ReadonlyArray<FileObservation>,
    ) => Effect.Effect<ReadonlyArray<File>, FileError>;
    readonly get: (id: FileId) => Effect.Effect<File | null, FileError>;
  }
>()("@stargeist/domain/Files") {}
