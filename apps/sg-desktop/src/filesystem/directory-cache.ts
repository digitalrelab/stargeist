import { rm } from "node:fs/promises";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as Drizzle from "drizzle-orm/effect-sqlite-node";
import { gte, sql } from "drizzle-orm";
import { FileSnapshot, DirectoryError, directoryPageSize } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema } from "effect";
import { Reactivity } from "effect/unstable/reactivity";
import { listingFiles } from "./cache-schema";
import initialSchema from "./cache-schema.json";

const storageUnavailable = () =>
  new DirectoryError({
    code: "StorageUnavailable",
    message: "Temporary storage could not be used. Check available disk space, then refresh.",
  });

const decodeFiles = Schema.decodeUnknownEffect(Schema.Array(FileSnapshot));

export const openDirectoryCache = Effect.fnUntraced(
  function* (filename: string) {
    yield* Effect.addFinalizer(() => Effect.promise(() => rm(filename, { force: true })));

    const client = yield* SqliteClient.make({ filename, disableWAL: true }).pipe(
      Effect.catchDefect((error) => Effect.fail(error)),
    );
    const database = yield* Drizzle.makeWithDefaults().pipe(
      Effect.provideService(SqliteClient.SqliteClient, client),
    );

    yield* database.run(sql`PRAGMA journal_mode = MEMORY`);
    yield* database.run(sql`PRAGMA synchronous = OFF`);
    yield* database.run(sql`PRAGMA cache_size = -2048`);

    for (const statement of initialSchema) {
      yield* database.run(sql.raw(statement));
    }

    let count = 0;
    const pending: FileSnapshot[] = [];

    const flush = Effect.gen(function* () {
      if (pending.length === 0) {
        return;
      }

      yield* database
        .insert(listingFiles)
        .values(
          pending.map(({ id, ...file }, index) => ({
            position: count + index,
            fileId: id,
            ...file,
          })),
        )
        .run();

      count += pending.length;
      pending.length = 0;
    }).pipe(Effect.uninterruptible);

    const read = Effect.fnUntraced(
      function* (offset: number) {
        yield* flush;

        const rows = yield* database
          .select({
            id: listingFiles.fileId,
            name: listingFiles.name,
            type: listingFiles.type,
            mediaType: listingFiles.mediaType,
          })
          .from(listingFiles)
          .where(gte(listingFiles.position, offset))
          .orderBy(listingFiles.position)
          .limit(directoryPageSize);

        return yield* decodeFiles(rows);
      },
      Effect.onError((cause) => reportFailure("directories.cache.read", cause)),
      Effect.mapError(storageUnavailable),
    );

    return {
      get committedCount() {
        return count;
      },
      get totalCount() {
        return count + pending.length;
      },
      append: (file: FileSnapshot) => {
        pending.push(file);
      },
      read,
    };
  },
  Effect.provide(Reactivity.layer),
  Effect.onError((cause) => reportFailure("directories.cache.open", cause)),
  Effect.mapError(storageUnavailable),
);
