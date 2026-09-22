import {
  FileId,
  FileMetadataError,
  type FileMetadata,
  type MetadataDefinition,
} from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors";
import { Cause, Effect, Schema } from "effect";
import { isSqlError } from "effect/unstable/sql/SqlError";
import { AppDatabase } from "../app/database";
import { fileMetadata } from "./schema";

const batchSize = 128;
const decodeFileId = Schema.decodeUnknownEffect(FileId);
const decodeFileIds = Schema.decodeUnknownEffect(Schema.Array(FileId));
const decodeKey = Schema.decodeUnknownEffect(Schema.NonEmptyString);

const forFiles = (key: string, ids: ReadonlyArray<FileId>) =>
  and(
    eq(fileMetadata.key, key),
    inArray(fileMetadata.fileId, sql`(SELECT value FROM json_each(${JSON.stringify(ids)}))`),
  );

const handleFailure = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.onError((cause) => reportFailure("files.metadata", cause)),
    Effect.mapError((error) => {
      let failure: unknown = error;
      if (error instanceof EffectDrizzleQueryError && Cause.isCause(error.cause)) {
        failure = Cause.squash(error.cause);
      }
      if (
        Schema.isSchemaError(failure) ||
        (isSqlError(failure) && failure.reason._tag === "ConstraintError")
      ) {
        return new FileMetadataError({ code: "InvalidMetadata", message: "File data is invalid." });
      }
      return new FileMetadataError({
        code: "StorageUnavailable",
        message: "File data could not be accessed. Check available disk space, then retry.",
      });
    }),
  );

export const makeFileMetadata = Effect.gen(function* () {
  const database = yield* AppDatabase;

  return {
    read: Effect.fnUntraced(function* <A>(
      definition: MetadataDefinition<A>,
      fileIds: ReadonlyArray<FileId>,
    ) {
      const key = yield* decodeKey(definition.key);
      const ids = yield* decodeFileIds(fileIds);
      const values = new Map<FileId, A>();
      if (ids.length === 0) return values;
      const decode = Schema.decodeUnknownEffect(
        Schema.fromJsonString(Schema.toCodecJson(definition.schema)),
        { onExcessProperty: "error" },
      );
      const rows = yield* database.select().from(fileMetadata).where(forFiles(key, ids)).all();
      for (const row of rows) values.set(row.fileId, yield* decode(row.value));
      return values;
    }, handleFailure),
    write: Effect.fnUntraced(function* <A>(
      definition: MetadataDefinition<A>,
      values: ReadonlyMap<FileId, NoInfer<A>>,
    ) {
      const key = yield* decodeKey(definition.key);
      if (values.size === 0) return;
      const encode = Schema.encodeEffect(
        Schema.fromJsonString(Schema.toCodecJson(definition.schema)),
        { onExcessProperty: "error" },
      );
      const rows: (typeof fileMetadata.$inferInsert)[] = [];
      for (const [fileId, value] of values) {
        rows.push({
          fileId: yield* decodeFileId(fileId),
          key,
          value: yield* encode(value),
        });
      }
      yield* database.transaction((transaction) =>
        Effect.gen(function* () {
          for (let start = 0; start < rows.length; start += batchSize) {
            yield* transaction
              .insert(fileMetadata)
              .values(rows.slice(start, start + batchSize))
              .onConflictDoUpdate({
                target: [fileMetadata.fileId, fileMetadata.key],
                set: { value: sql`excluded.value` },
                setWhere: ne(fileMetadata.value, sql`excluded.value`),
              })
              .run();
          }
        }),
      );
    }, handleFailure),
    remove: Effect.fnUntraced(function* (definition, fileIds) {
      const key = yield* decodeKey(definition.key);
      const ids = yield* decodeFileIds(fileIds);
      if (ids.length === 0) return;
      yield* database.delete(fileMetadata).where(forFiles(key, ids)).run();
    }, handleFailure),
  } satisfies FileMetadata;
});
