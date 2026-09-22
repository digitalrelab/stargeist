import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileReference, Files } from "@stargeist/domain";
import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDatabase, openDatabase } from "../app/database";
import { filesLayer } from "./service";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-files-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const layer = filesLayer.pipe(
    Layer.provideMerge(Layer.effect(AppDatabase, openDatabase(join(root, "application.sqlite")))),
  );
  const run = <A, E>(effect: Effect.Effect<A, E, Files | AppDatabase>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));
  return { run };
}

const reference = (source: string, key: string) => FileReference.make({ source, key });

it("keeps IDs stable for a reference and separates references from different sources", async () => {
  const { run } = await fixture();
  const references = [
    reference("local", "/folder/file.txt"),
    reference("local", "/folder/file.txt"),
    reference("remote", "/folder/file.txt"),
  ];
  const first = await run(Effect.flatMap(Files, (files) => files.ensure(references)));
  const second = await run(Effect.flatMap(Files, (files) => files.ensure(references)));
  expect(first).toEqual(second);
  expect(first[0]!.id).toBe(first[1]!.id);
  expect(first[0]!.id).not.toBe(first[2]!.id);
});

it("keeps IDs consistent across SQL batches and concurrent requests", async () => {
  const { run } = await fixture();
  const references = Array.from({ length: 300 }, (_, index) =>
    reference("local", `/folder/file-${index}`),
  );
  const [first, second] = await run(
    Effect.flatMap(Files, (files) =>
      Effect.all([files.ensure(references), files.ensure(references)], { concurrency: 2 }),
    ),
  );
  expect(first).toEqual(second);
  expect(new Set(first.map((file) => file.id)).size).toBe(300);
});

it("rolls back a failed batch without changing existing IDs", async () => {
  const { run } = await fixture();
  await run(
    Effect.gen(function* () {
      const database = yield* AppDatabase;
      const files = yield* Files;
      const [original] = yield* files.ensure([reference("local", "/original")]);
      yield* database.run(
        sql.raw(
          "CREATE TEMP TRIGGER reject_file BEFORE INSERT ON files WHEN new.key = '/reject' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
        ),
      );
      const batch = Array.from({ length: 130 }, (_, index) => reference("local", `/file-${index}`));
      batch.push(reference("local", "/reject"));
      expect((yield* files.ensure(batch).pipe(Effect.flip)).code).toBe("StorageUnavailable");
      expect(
        yield* database.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM files`),
      ).toEqual({
        count: 1,
      });
      yield* database.run(sql`DROP TRIGGER reject_file`);
      expect((yield* files.ensure([reference("local", "/original")]))[0]!.id).toBe(original!.id);
    }),
  );
});
