import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { makeWorkspaceId } from "@stargeist/domain";
import { Effect, Exit, Layer } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDatabase, openDatabase } from "./database";
import { makeWorkspaceStore } from "../workspaces/service";

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-database-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  return { folder, filename: join(folder, "application.sqlite") };
}

it("initializes concurrently and retains records after the database is reopened", async () => {
  const { folder, filename } = await fixture();
  const layer = Layer.effect(AppDatabase, openDatabase(filename));
  await Effect.runPromise(
    Effect.all(
      [
        AppDatabase.pipe(Effect.provide(layer)),
        AppDatabase.pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
      ],
      { concurrency: 2 },
    ),
  );
  const record = await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "workspace", root: "/workspace" };
      yield* store.modify((records) => records.put(record));
      return record;
    }).pipe(Effect.provide(layer)),
  );
  const records = await Effect.runPromise(
    makeWorkspaceStore.pipe(
      Effect.flatMap((store) => store.list),
      Effect.provide(Layer.effect(AppDatabase, openDatabase(filename))),
    ),
  );
  expect(records).toEqual([record]);
  expect(await readdir(folder)).toEqual(["application.sqlite"]);
});

it.each(["invalid sqlite database", ""])(
  "rejects an invalid existing database without changing its contents: %j",
  async (contents) => {
    const { filename } = await fixture();
    await writeFile(filename, contents);
    const result = await Effect.runPromiseExit(
      AppDatabase.pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
    );
    expect(Exit.isFailure(result)).toBe(true);
    expect(await readFile(filename, "utf8")).toBe(contents);
  },
);

it("rejects an existing schema without repairing or changing it", async () => {
  const { filename } = await fixture();
  using existing = new DatabaseSync(filename);
  existing.exec("CREATE TABLE preserved (value TEXT NOT NULL)");
  existing.exec("INSERT INTO preserved VALUES ('original')");
  const before = await readFile(filename);
  const result = await Effect.runPromiseExit(
    AppDatabase.pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
  );
  expect(Exit.isFailure(result)).toBe(true);
  expect(await readFile(filename)).toEqual(before);
  expect(existing.prepare("SELECT * FROM preserved").all()).toEqual([{ value: "original" }]);
});

it("rejects extra tables whose names resemble SQLite's internal prefix", async () => {
  const { filename } = await fixture();
  await Effect.runPromise(
    AppDatabase.pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
  );
  {
    using database = new DatabaseSync(filename);
    database.exec("CREATE TABLE sqliteextra (value TEXT)");
  }
  const before = await readFile(filename);
  const result = await Effect.runPromiseExit(
    AppDatabase.pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
  );
  expect(Exit.isFailure(result)).toBe(true);
  expect(await readFile(filename)).toEqual(before);
});
