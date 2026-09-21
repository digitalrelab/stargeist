import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as Drizzle from "drizzle-orm/effect-sqlite-node";
import { sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import initialSchema from "./initial-schema.json";

export class Database extends Context.Service<Database, Drizzle.EffectSQLiteNodeDatabase>()(
  "@stargeist/database/Database",
) {}

export const sqliteLayer = ({ filename }: { readonly filename: string }) =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const database = yield* Drizzle.makeWithDefaults();

      yield* database.run(sql`PRAGMA foreign_keys = ON`);
      yield* database.transaction((transaction) =>
        Effect.gen(function* () {
          const version = yield* transaction.get<{ user_version: number }>(
            sql`PRAGMA user_version`,
          );

          if (version.user_version === 0) {
            for (const statement of initialSchema) {
              yield* transaction.run(sql.raw(statement));
            }

            yield* transaction.run(sql`PRAGMA user_version = 1`);
          }
        }),
      );

      return database;
    }),
  ).pipe(
    Layer.provide(SqliteClient.layer({ filename, prepareCacheSize: 32, busyTimeout: "1 second" })),
  );
