import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileObservation, Files, makeFileId } from "@stargeist/domain";
import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDatabase, openDatabase } from "../app/database";
import { filesLayer } from "./service";

const observation = (objectKey: string, name = "file.txt", source = "remote-account") =>
  FileObservation.make({ source, objectKey, name, type: "file", mediaType: "text/plain" });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-files-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const filename = join(root, "application.sqlite");
  const layer = filesLayer.pipe(
    Layer.provideMerge(Layer.effect(AppDatabase, openDatabase(filename))),
  );
  const run = <A, E>(effect: Effect.Effect<A, E, Files | AppDatabase>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));
  return { run, layer };
}

it("persists IDs and last observed descriptions while preserving each observed name", async () => {
  const { run } = await fixture();
  const first = await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const result = yield* files.remember([
        observation("object-1", "first.txt"),
        observation("object-1", "alias.txt"),
        observation("object-1", "other.txt", "other-account"),
        observation("object-2", "replacement.txt"),
      ]);
      expect(result.map(({ name }) => name)).toEqual([
        "first.txt",
        "alias.txt",
        "other.txt",
        "replacement.txt",
      ]);
      expect(result[0]!.id).toBe(result[1]!.id);
      expect(new Set(result.map(({ id }) => id)).size).toBe(3);
      expect(yield* files.get(result[0]!.id)).toEqual(result[1]);
      expect(yield* files.get(yield* makeFileId)).toBeNull();
      return result;
    }),
  );
  await run(
    Effect.gen(function* () {
      const files = yield* Files;
      expect(yield* files.get(first[0]!.id)).toEqual(first[1]);
      const [renamed] = yield* files.remember([observation("object-1", "renamed.txt")]);
      expect(renamed!.id).toBe(first[0]!.id);
      expect(yield* files.get(first[0]!.id)).toEqual(renamed);
    }),
  );
});

it("keeps source identities consistent across internal SQL batches and concurrent requests", async () => {
  const { run } = await fixture();
  const observations = Array.from({ length: 300 }, (_, i) => observation(`object-${i}`));
  observations.push(observation("object-0", "alias.txt"));
  await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const [first, second] = yield* Effect.all(
        [files.remember(observations), files.remember(observations)],
        { concurrency: 2 },
      );
      expect(first).toEqual(second);
      expect(new Set(first.map(({ id }) => id)).size).toBe(300);
      expect(first[0]!.id).toBe(first[300]!.id);
      expect(yield* files.get(first[0]!.id)).toEqual(first[300]);
    }),
  );
});

it("rolls back a failed observation batch before exposing any file identities", async () => {
  const { run } = await fixture();
  await run(
    Effect.gen(function* () {
      const database = yield* AppDatabase;
      const files = yield* Files;
      const [original] = yield* files.remember([observation("object-0", "original.txt")]);
      yield* database.run(
        sql.raw(
          "CREATE TEMP TRIGGER reject_file BEFORE INSERT ON files WHEN new.name = 'reject.txt' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
        ),
      );
      const observations = Array.from({ length: 130 }, (_, index) =>
        observation(`object-${index}`),
      );
      observations.push(observation("rejected-object", "reject.txt"));
      const error = yield* files.remember(observations).pipe(Effect.flip);
      expect(error.code).toBe("StorageUnavailable");
      expect(
        yield* database.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM files`),
      ).toEqual({ count: 1 });
      expect(yield* files.get(original!.id)).toEqual(original);
      yield* database.run(sql`DROP TRIGGER reject_file`);
      const result = yield* files.remember([observation("object-1")]);
      expect(result).toHaveLength(1);
      expect(yield* files.get(result[0]!.id)).toEqual(result[0]);
    }),
  );
});
