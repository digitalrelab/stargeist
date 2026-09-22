import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as Drizzle from "drizzle-orm/effect-sqlite-node";
import { sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import initialSchema from "./initial-schema.json";

const schemaVersion = 1;

export const openDatabase = Effect.fnUntraced(function* (filename: string) {
  const context = yield* Layer.build(
    SqliteClient.layer({ filename, prepareCacheSize: 32, busyTimeout: "1 second" }),
  ).pipe(Effect.catchDefect((error) => Effect.fail(error)));
  const database = yield* Drizzle.makeWithDefaults().pipe(Effect.provide(context));

  yield* database.run(sql`PRAGMA foreign_keys = ON`);
  yield* database.transaction((transaction) =>
    Effect.gen(function* () {
      const version = yield* transaction.get<{ user_version: number }>(sql`PRAGMA user_version`);

      if (version.user_version === schemaVersion) return;

      if (version.user_version !== 0) {
        return yield* Effect.fail(
          new Error(
            `Unsupported workspace database schema version ${version.user_version}; expected ${schemaVersion}.`,
          ),
        );
      }

      for (const statement of initialSchema) {
        yield* transaction.run(sql.raw(statement));
      }

      yield* transaction.run(sql.raw(`PRAGMA user_version = ${schemaVersion}`));
    }),
  );

  return database;
});
