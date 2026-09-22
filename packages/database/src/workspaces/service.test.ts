import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { WorkspaceError, makeWorkspaceId } from "@stargeist/domain";
import { Deferred, Effect, Fiber } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { openWorkspaceStore } from "./index";

it("reports an unreadable database as a storage failure and preserves it", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "store.sqlite");
  await writeFile(filename, "invalid sqlite database");
  const error = await Effect.runPromise(
    openWorkspaceStore(filename).pipe(Effect.scoped, Effect.flip),
  );
  expect(error).toBeInstanceOf(WorkspaceError);
  expect(error.code).toBe("StorageUnavailable");
  expect(await readFile(filename, "utf8")).toBe("invalid sqlite database");
});

it.each([-1, 2])(
  "rejects unsupported schema version %i without changing the database",
  async (version) => {
    const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
    onTestFinished(() => rm(folder, { recursive: true, force: true }));
    const filename = join(folder, "store.sqlite");
    using database = new DatabaseSync(filename);
    database.exec("CREATE TABLE preserved (value TEXT NOT NULL)");
    database.exec("INSERT INTO preserved VALUES ('original')");
    database.exec(`PRAGMA user_version = ${version}`);
    const schema = database.prepare("SELECT * FROM sqlite_schema").all();

    const error = await Effect.runPromise(
      openWorkspaceStore(filename).pipe(Effect.scoped, Effect.flip),
    );

    expect(error).toBeInstanceOf(WorkspaceError);
    expect(error.code).toBe("StorageUnavailable");
    expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: version });
    expect(database.prepare("SELECT * FROM sqlite_schema").all()).toEqual(schema);
    expect(database.prepare("SELECT * FROM preserved").all()).toEqual([{ value: "original" }]);
  },
);

it("rolls back partial changes on domain failure and interruption", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* openWorkspaceStore(join(folder, "store.sqlite"));
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
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});
