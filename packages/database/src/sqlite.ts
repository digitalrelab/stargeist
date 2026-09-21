import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as SqliteMigrator from "@effect/sql-sqlite-node/SqliteMigrator";
import { Effect, Layer } from "effect";
import { Reactivity } from "effect/unstable/reactivity";
import { SqlClient } from "effect/unstable/sql";
import { migrations } from "./migrations";

export const sqliteLayer = ({ filename }: { readonly filename: string }) =>
  Layer.effect(
    SqlClient.SqlClient,
    Effect.gen(function* () {
      const sql = yield* SqliteClient.make({
        filename,
        prepareCacheSize: 32,
        busyTimeout: "1 second",
      });
      yield* SqliteMigrator.run({ loader: migrations }).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
      );
      return sql;
    }),
  ).pipe(Layer.provide(Reactivity.layer));
