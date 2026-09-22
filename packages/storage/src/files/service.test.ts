import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FileReference,
  Files,
  FileKindMetadata,
  makeFileId,
  type MetadataDefinition,
} from "@stargeist/domain";
import { Effect, Layer, Schema } from "effect";
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

const Note = {
  key: "test.note",
  schema: Schema.NullOr(Schema.NonEmptyString),
} satisfies MetadataDefinition<string | null>;

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

it("persists structured metadata independently by file and definition across reopening", async () => {
  const { run } = await fixture();
  const Details = {
    key: "test.details",
    schema: Schema.Struct({
      sections: Schema.Array(Schema.Struct({ text: Schema.String })),
      reviewedAt: Schema.DateFromString,
    }),
  };
  const details = { sections: [{ text: "A section" }], reviewedAt: new Date("2026-01-01") };
  const [first, second] = await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const [first, second] = yield* files.ensure([
        reference("local", "/first"),
        reference("remote", "second"),
      ]);
      yield* files.metadata.write(Details, new Map([[first!.id, details]]));
      yield* files.metadata.write(
        Note,
        new Map([
          [first!.id, null],
          [second!.id, "Keep me"],
        ]),
      );
      yield* files.metadata.write(FileKindMetadata, new Map([[first!.id, "image"]]));
      return [first!, second!] as const;
    }),
  );

  await run(
    Effect.gen(function* () {
      const { metadata } = yield* Files;
      const ids = [first.id, second.id];
      expect(yield* metadata.read(Details, ids)).toEqual(new Map([[first.id, details]]));
      yield* metadata.write(Details, new Map([[first.id, { ...details, sections: [] }]]));
      const undeclared = { ...details, extra: "Must not be discarded" };
      expect(
        (yield* metadata.write(Details, new Map([[first.id, undeclared]])).pipe(Effect.flip)).code,
      ).toBe("InvalidMetadata");
      expect(yield* metadata.read(Details, ids)).toEqual(
        new Map([[first.id, { ...details, sections: [] }]]),
      );
      expect(yield* metadata.read(Note, ids)).toEqual(
        new Map([
          [first.id, null],
          [second.id, "Keep me"],
        ]),
      );
      yield* metadata.remove(Note, [first.id]);
      expect(yield* metadata.read(Note, ids)).toEqual(new Map([[second.id, "Keep me"]]));
      expect(yield* metadata.read(FileKindMetadata, ids)).toEqual(new Map([[first.id, "image"]]));
      yield* metadata.write(Note, new Map([[first.id, "Restored"]]));
      expect((yield* metadata.read(Note, ids)).get(first.id)).toBe("Restored");
    }),
  );
});

it("rejects invalid metadata without partial updates and reports invalid stored data", async () => {
  const { run } = await fixture();
  await run(
    Effect.gen(function* () {
      const { ensure, metadata } = yield* Files;
      const [first, second] = yield* ensure([
        reference("local", "/first"),
        reference("local", "/second"),
      ]);
      const original = new Map([[first!.id, "Original"]]);
      yield* metadata.write(Note, original);
      const error = yield* metadata
        .write(
          Note,
          new Map([
            [first!.id, "Changed"],
            [second!.id, ""],
          ]),
        )
        .pipe(Effect.flip);
      expect(error.code).toBe("InvalidMetadata");
      expect(yield* metadata.read(Note, [first!.id, second!.id])).toEqual(original);

      const database = yield* AppDatabase;
      yield* database.run(sql`UPDATE file_metadata SET value = '42' WHERE file_id = ${first!.id}`);
      expect((yield* metadata.read(Note, [first!.id]).pipe(Effect.flip)).code).toBe(
        "InvalidMetadata",
      );
    }),
  );
});

it("keeps batched metadata writes and removals atomic and rejects unknown file IDs", async () => {
  const { run } = await fixture();
  await run(
    Effect.gen(function* () {
      const { ensure, metadata } = yield* Files;
      const files = yield* ensure(
        Array.from({ length: 300 }, (_, index) => reference("local", `/file-${index}`)),
      );
      const ids = files.map((file) => file.id);
      const original = new Map(ids.map((id) => [id, "Original"]));
      original.set(ids.at(-1)!, "Stop");
      yield* metadata.write(Note, original);

      const replacement = new Map(ids.map((id) => [id, "Changed"]));
      replacement.set(yield* makeFileId, "Unknown file");
      expect((yield* metadata.write(Note, replacement).pipe(Effect.flip)).code).toBe(
        "InvalidMetadata",
      );
      expect(yield* metadata.read(Note, ids)).toEqual(original);

      const database = yield* AppDatabase;
      yield* database.run(
        sql.raw(
          `CREATE TEMP TRIGGER reject_removal BEFORE DELETE ON file_metadata WHEN old.value = '"Stop"' BEGIN SELECT RAISE(ABORT, 'rejected'); END`,
        ),
      );
      expect((yield* metadata.remove(Note, ids).pipe(Effect.flip)).code).toBe("InvalidMetadata");
      expect(yield* metadata.read(Note, ids)).toEqual(original);
      yield* database.run(sql`DROP TRIGGER reject_removal`);
      yield* metadata.remove(Note, ids);
      expect(yield* metadata.read(Note, ids)).toEqual(new Map());
      yield* database.run(sql`PRAGMA query_only = ON`);
      expect((yield* metadata.write(Note, original).pipe(Effect.flip)).code).toBe(
        "StorageUnavailable",
      );
      expect(yield* metadata.read(Note, ids)).toEqual(new Map());
    }),
  );
});
