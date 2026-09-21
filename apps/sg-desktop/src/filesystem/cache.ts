import { unlink } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { FileSystemEntry, DirectoryError, entryPageSize } from "@stargeist/domain/filesystem";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema } from "effect";

const storageUnavailable = () =>
  new DirectoryError({
    code: "StorageUnavailable",
    message: "Temporary storage could not be used. Check available disk space, then refresh.",
  });

const decodeEntries = Schema.decodeUnknownEffect(Schema.Array(FileSystemEntry));

export const openDirectoryCache = (filename: string) =>
  Effect.gen(function* () {
    const database = yield* Effect.acquireRelease(
      Effect.try(() => new DatabaseSync(filename)).pipe(
        Effect.onError((cause) => reportFailure("directories.cache.open", cause)),
        Effect.mapError(storageUnavailable),
      ),
      (database) =>
        Effect.sync(() => database.close()).pipe(
          Effect.ensuring(Effect.promise(() => unlink(filename))),
        ),
    );

    const statements = yield* Effect.try(() => {
      database.exec(`
        PRAGMA journal_mode = MEMORY;
        PRAGMA synchronous = OFF;
        PRAGMA cache_size = -2048;
        CREATE TABLE entries (position INTEGER PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
      `);

      return {
        insert: database.prepare("INSERT INTO entries VALUES (?, ?, ?)"),
        select: database.prepare(
          "SELECT name, kind FROM entries WHERE position >= ? ORDER BY position LIMIT ?",
        ),
      };
    }).pipe(
      Effect.onError((cause) => reportFailure("directories.cache.initialize", cause)),
      Effect.mapError(storageUnavailable),
    );

    let count = 0;
    const pending: FileSystemEntry[] = [];

    const flush = () => {
      if (pending.length === 0) return;

      database.exec("BEGIN");

      try {
        for (const [index, entry] of pending.entries()) {
          statements.insert.run(count + index, entry.name, entry.kind);
        }

        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }

      count += pending.length;
      pending.length = 0;
    };

    const read = (offset: number) =>
      Effect.try(() => {
        flush();
        return statements.select.all(offset, entryPageSize);
      }).pipe(
        Effect.flatMap((rows) => decodeEntries(rows).pipe(Effect.orDie)),
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
      append: (entry: FileSystemEntry) => {
        pending.push(entry);
      },
      read,
    };
  });
