import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError, makeWorkspaceId } from "@stargeist/domain";
import { Deferred, Effect, Fiber } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { Database, databaseLayer } from "../database";
import { makeWorkspaceStore } from "./index";

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
      Effect.provide(databaseLayer(join(folder, "application.sqlite"))),
      Effect.timeout("3 seconds"),
    ),
  );
});

it("participates in a transaction owned by the shared database", async () => {
  const folder = await mkdtemp(join(tmpdir(), "stargeist-store-"));
  onTestFinished(() => rm(folder, { recursive: true, force: true }));
  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* Database;
      const store = yield* makeWorkspaceStore;
      const record = { id: yield* makeWorkspaceId, identity: "original", root: "/original" };
      const failure = new WorkspaceError({ code: "RootConflict", message: "Occupied" });
      yield* database
        .transaction(() =>
          store.modify((records) => records.put(record)).pipe(Effect.andThen(Effect.fail(failure))),
        )
        .pipe(Effect.flip);
      expect(yield* store.list).toEqual([]);
    }).pipe(Effect.provide(databaseLayer(join(folder, "application.sqlite")))),
  );
});
