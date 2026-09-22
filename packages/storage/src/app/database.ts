import { link, lstat, mkdir, mkdtemp, open, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import * as Drizzle from "drizzle-orm/effect-sqlite-node";
import { sql } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";
import fileSchema from "../files/initial-schema.json";
import workspaceSchema from "../workspaces/initial-schema.json";

const statements = [...workspaceSchema, ...fileSchema];
const decodeSchema = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      type: Schema.String,
      name: Schema.String,
      tbl_name: Schema.String,
      sql: Schema.NullOr(Schema.String),
    }),
  ),
);

function schema(database: DatabaseSync) {
  return decodeSchema(
    database
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT GLOB 'sqlite_*' ORDER BY type, name",
      )
      .all(),
  );
}

function initialize(database: DatabaseSync) {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const statement of statements) database.exec(statement);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function validate(filename: string) {
  using expected = new DatabaseSync(":memory:");
  initialize(expected);
  using existing = new DatabaseSync(filename, { readOnly: true });
  if (JSON.stringify(schema(existing)) !== JSON.stringify(schema(expected))) {
    throw new Error("Application database schema does not match this build.");
  }
}

async function syncDirectory(path: string) {
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

async function prepare(filename: string) {
  const directory = dirname(filename);
  await mkdir(directory, { recursive: true });
  try {
    if (!(await lstat(filename)).isFile()) {
      throw new Error("Application database must be a regular file.");
    }
    validate(filename);
    return;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  const temporary = await mkdtemp(join(directory, ".application-database-"));
  try {
    const staged = join(temporary, basename(filename));
    const file = await open(staged, "wx", 0o600);
    await file.close();
    {
      using database = new DatabaseSync(staged);
      initialize(database);
    }
    try {
      await link(staged, filename);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    await syncDirectory(directory);
    if (!(await lstat(filename)).isFile()) {
      throw new Error("Application database must be a regular file.");
    }
    validate(filename);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export class AppDatabase extends Context.Service<AppDatabase, Drizzle.EffectSQLiteNodeDatabase>()(
  "@stargeist/storage/AppDatabase",
) {}

export const openDatabase = Effect.fnUntraced(function* (filename: string) {
  yield* Effect.tryPromise(() => prepare(filename));
  const context = yield* Layer.build(
    SqliteClient.layer({ filename, prepareCacheSize: 32, busyTimeout: "1 second" }),
  ).pipe(Effect.catchDefect((error) => Effect.fail(error)));
  const database = yield* Drizzle.makeWithDefaults().pipe(Effect.provide(context));
  yield* database.run(sql`PRAGMA foreign_keys = ON`);
  yield* database.run(sql`PRAGMA synchronous = FULL`);
  return database;
});
