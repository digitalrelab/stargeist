import { mkdtemp, readFile, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError, makeWorkspaceId } from "@stargeist/domain";
import { sql } from "drizzle-orm";
import { Deferred, Effect, Fiber, Layer } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDatabase, openDatabase } from "../app/database";
import { makeWorkspaceStore } from "./service";
import { readWorkspaceRoots } from "./inspection";

it("rolls back partial changes on domain failure and interruption", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "original", root: "/original" };
      yield* store.modify((records) => records.put(record));
      const failure = new WorkspaceError({ code: "RootConflict", message: "Occupied" });
      const result = yield* store
        .modify((records) => records.remove(record.id).pipe(Effect.andThen(Effect.fail(failure))))
        .pipe(Effect.flip);
      expect(result).toBe(failure);
      expect(yield* store.get(record.id)).toEqual(record);
      const modified = yield* Deferred.make<void>();
      const fiber = yield* store
        .modify((records) =>
          records
            .remove(record.id)
            .pipe(
              Effect.andThen(Deferred.succeed(modified, undefined)),
              Effect.andThen(Effect.never),
            ),
        )
        .pipe(Effect.forkChild);
      yield* Deferred.await(modified);
      yield* Fiber.interrupt(fiber);
      expect(yield* store.list).toEqual([record]);
    }).pipe(
      Effect.provide(Layer.effect(AppDatabase, openDatabase(join(folder, "application.sqlite")))),
      Effect.timeout("3 seconds"),
    ),
  );
});

it("participates in a transaction owned by the shared database", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* AppDatabase;
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "original", root: "/original" };
      const failure = new WorkspaceError({ code: "RootConflict", message: "Occupied" });
      yield* database
        .transaction(() =>
          store.modify((records) => records.put(record)).pipe(Effect.andThen(Effect.fail(failure))),
        )
        .pipe(Effect.flip);
      expect(yield* store.list).toEqual([]);
    }).pipe(
      Effect.provide(Layer.effect(AppDatabase, openDatabase(join(folder, "application.sqlite")))),
    ),
  );
});

it("moves file references with a workspace without touching sibling paths or losing IDs", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* AppDatabase;
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "workspace", root: "/original-🚀" };
      yield* store.modify((records) => records.put(record));
      yield* database.run(sql`
        INSERT INTO files (id, source, key) VALUES
          ('file-1', 'local', '/original-🚀/notes.txt'),
          ('file-2', 'local', '/original-🚀-copy/notes.txt'),
          ('file-3', 'remote', '/original-🚀/notes.txt')
      `);
      yield* store.modify((records) => records.relocate(record, "/moved-🌟"));
      expect(yield* store.get(record.id)).toEqual({ ...record, root: "/moved-🌟" });
      expect(
        yield* database.all<{ id: string; key: string }>(
          sql`SELECT id, key FROM files ORDER BY id`,
        ),
      ).toEqual([
        { id: "file-1", key: "/moved-🌟/notes.txt" },
        { id: "file-2", key: "/original-🚀-copy/notes.txt" },
        { id: "file-3", key: "/original-🚀/notes.txt" },
      ]);
    }).pipe(
      Effect.provide(Layer.effect(AppDatabase, openDatabase(join(folder, "application.sqlite")))),
    ),
  );
});

it("keeps both workspace and file references unchanged when the new path is occupied", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* AppDatabase;
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "workspace", root: "/original" };
      yield* store.modify((records) => records.put(record));
      yield* database.run(sql`
        INSERT INTO files (id, source, key) VALUES
          ('file-1', 'local', '/original/notes.txt'),
          ('file-2', 'local', '/moved/notes.txt')
      `);
      expect(
        (yield* store.modify((records) => records.relocate(record, "/moved")).pipe(Effect.flip))
          .code,
      ).toBe("RootConflict");
      expect(yield* store.get(record.id)).toEqual(record);
      expect(yield* database.all<{ key: string }>(sql`SELECT key FROM files ORDER BY id`)).toEqual([
        { key: "/original/notes.txt" },
        { key: "/moved/notes.txt" },
      ]);
    }).pipe(
      Effect.provide(Layer.effect(AppDatabase, openDatabase(join(folder, "application.sqlite")))),
    ),
  );
});

it("reads known roots without changing the database or requiring unrelated tables to match", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-inspect-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "application.sqlite");
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "workspace", root: "/workspace" };
      yield* store.modify((records) => records.put(record));
    }).pipe(Effect.provide(Layer.effect(AppDatabase, openDatabase(filename)))),
  );
  {
    using database = new DatabaseSync(filename);
    database.exec("DROP TABLE files");
  }
  const before = await readFile(filename);
  expect(readWorkspaceRoots(filename)).toEqual(["/workspace"]);
  expect(await readFile(filename)).toEqual(before);
});
