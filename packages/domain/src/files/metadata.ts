import { Schema, type Effect } from "effect";
import type { FileId } from "./file";

export interface MetadataDefinition<A> {
  readonly key: string;
  readonly schema: Schema.Codec<A, unknown>;
}

export class FileMetadataError extends Schema.Error<FileMetadataError>("FileMetadataError")({
  _tag: Schema.tag("FileMetadataError"),
  code: Schema.Literals(["InvalidMetadata", "StorageUnavailable"]),
  message: Schema.String,
}) {}

export interface FileMetadata {
  readonly read: <A>(
    definition: MetadataDefinition<A>,
    fileIds: ReadonlyArray<FileId>,
  ) => Effect.Effect<ReadonlyMap<FileId, A>, FileMetadataError>;
  readonly write: <A>(
    definition: MetadataDefinition<A>,
    values: ReadonlyMap<FileId, NoInfer<A>>,
  ) => Effect.Effect<void, FileMetadataError>;
  readonly remove: (
    definition: MetadataDefinition<unknown>,
    fileIds: ReadonlyArray<FileId>,
  ) => Effect.Effect<void, FileMetadataError>;
}
