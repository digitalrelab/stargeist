import { rm } from "node:fs/promises";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as Drizzle from "drizzle-orm/effect-sqlite-node";
import { gte, sql } from "drizzle-orm";
import { File, DirectoryError, entryPageSize } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema } from "effect";
import { Reactivity } from "effect/unstable/reactivity";
import { entries } from "./schema";
import initialSchema from "./initial-schema.json";

const storageUnavailable = () =>
  new DirectoryError({
    code: "StorageUnavailable",
    message: "Temporary storage could not be used. Check available disk space, then refresh.",
  });

const decodeEntries = Schema.decodeUnknownEffect(Schema.Array(File));

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
    const pending: File[] = [];

    const flush = Effect.gen(function* () {
      if (pending.length === 0) {
        return;
      }

      yield* database
        .insert(entries)
        .values(pending.map((entry, index) => ({ position: count + index, ...entry })))
        .run();

      count += pending.length;
      pending.length = 0;
    }).pipe(Effect.uninterruptible);

    const read = Effect.fnUntraced(
      function* (offset: number) {
        yield* flush;

        const rows = yield* database
          .select({
            id: entries.id,
            name: entries.name,
            type: entries.type,
            mediaType: entries.mediaType,
          })
          .from(entries)
          .where(gte(entries.position, offset))
          .orderBy(entries.position)
          .limit(entryPageSize);

        return yield* decodeEntries(rows);
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
      append: (entry: File) => {
        pending.push(entry);
      },
      read,
    };
  },
  Effect.provide(Reactivity.layer),
  Effect.onError((cause) => reportFailure("directories.cache.open", cause)),
  Effect.mapError(storageUnavailable),
);
