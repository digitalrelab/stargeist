import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileError, FileObservation, Files, makeFileId } from "@stargeist/domain";
import { Effect, Layer } from "effect";
import { sql } from "drizzle-orm";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDatabase, openDatabase } from "../app/database";
import { filesLayer, type FileIdentityVerifier } from "./service";

const observation = (
  objectKey: string,
  name = "file.txt",
  source = "remote-account",
  evidence: string | null = null,
) =>
  FileObservation.make({
    source,
    objectKey,
    evidence,
    name,
    type: "file",
    mediaType: "text/plain",
  });

async function fixture(verifyIdentities?: FileIdentityVerifier) {
  const root = await mkdtemp(join(tmpdir(), "stargeist-files-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const filename = join(root, "application.sqlite");
  const layer = filesLayer(verifyIdentities).pipe(
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

it("persists continuity evidence and preserves retired file IDs when a source reuses an object key", async () => {
  const { run } = await fixture((comparisons) =>
    Effect.sync(() =>
      comparisons.map(({ previous, current }) => {
        if (previous.evidence === "first" && current.evidence === "continued") return "same";
        if (previous.evidence === "continued" && current.evidence === "replacement")
          return "different";
        if (previous.evidence === "replacement" && current.evidence === "replacement")
          return "same";
        throw new Error("Unexpected continuity comparison");
      }),
    ),
  );
  const remember = (evidence: string, name = "file.txt") =>
    Effect.flatMap(Files, (files) =>
      files.remember([observation("reused", name, "local", evidence)]),
    );

  const [original] = await run(remember("first"));
  const [continued] = await run(remember("continued"));
  expect(continued!.id).toBe(original!.id);
  const replacements = await run(
    Effect.all(
      [remember("replacement", "replacement.txt"), remember("replacement", "replacement.txt")],
      { concurrency: 2 },
    ),
  );
  const replacement = replacements[0][0]!;
  expect(replacement.id).not.toBe(original!.id);
  expect(replacements[1][0]!.id).toBe(replacement.id);
  expect(await run(Effect.flatMap(Files, (files) => files.get(original!.id)))).toEqual(original);
  expect(await run(Effect.flatMap(Files, (files) => files.get(replacement.id)))).toEqual(
    replacement,
  );
});

it("compares repeated object keys in observation order within one batch", async () => {
  const { run } = await fixture((comparisons) =>
    Effect.sync(() => {
      expect(
        comparisons.map(({ previous, current }) => [previous.evidence, current.evidence]),
      ).toEqual([
        ["first", "replacement"],
        ["replacement", "continued"],
      ]);
      return ["different", "same"];
    }),
  );
  const result = await run(
    Effect.flatMap(Files, (files) =>
      files.remember([
        observation("reused", "original.txt", "local", "first"),
        observation("reused", "replacement.txt", "local", "replacement"),
        observation("reused", "alias.txt", "local", "continued"),
      ]),
    ),
  );
  expect(result[0]!.id).not.toBe(result[1]!.id);
  expect(result[1]!.id).toBe(result[2]!.id);
  expect(await run(Effect.flatMap(Files, (files) => files.get(result[0]!.id)))).toEqual(result[0]);
  expect(await run(Effect.flatMap(Files, (files) => files.get(result[1]!.id)))).toEqual(result[2]);
});

it("rolls back retirements and evidence when continuity cannot be verified", async () => {
  const failure = new FileError({
    code: "IdentityUnavailable",
    message: "History is unavailable.",
  });
  const { run } = await fixture((comparisons) =>
    Effect.gen(function* () {
      if (comparisons.some(({ current }) => current.evidence === "unknown")) return yield* failure;
      for (const { previous } of comparisons) expect(previous.evidence).toBe("first");
      return comparisons.map(() => "different" as const);
    }),
  );
  await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const [original] = yield* files.remember([
        observation("reused", "original.txt", "local", "first"),
      ]);
      const batch = [observation("reused", "replacement.txt", "local", "replacement")];
      for (let index = 0; index < 127; index++) batch.push(observation(`new-${index}`));
      batch.push(observation("reused", "unknown.txt", "local", "unknown"));
      expect(yield* files.remember(batch).pipe(Effect.flip)).toBe(failure);
      expect(yield* files.get(original!.id)).toEqual(original);
      const database = yield* AppDatabase;
      expect(
        yield* database.get<{ count: number }>(sql`SELECT COUNT(*) AS count FROM files`),
      ).toEqual({ count: 1 });
      const [replacement] = yield* files.remember([
        observation("reused", "replacement.txt", "local", "replacement"),
      ]);
      expect(replacement!.id).not.toBe(original!.id);
    }),
  );
});

it("refuses to reuse an identity requiring unavailable evidence verification", async () => {
  const { run } = await fixture();
  await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const observed = observation("reused", "file.txt", "local", "witness");
      const [original] = yield* files.remember([observed]);
      const failure = yield* files.remember([observed]).pipe(Effect.flip);
      expect(failure.code).toBe("IdentityUnavailable");
      expect(yield* files.get(original!.id)).toEqual(original);
    }),
  );
});

it("keeps recorded identity and metadata when an older observation expires, then accepts a fresh observation", async () => {
  const { run } = await fixture((comparisons) =>
    Effect.gen(function* () {
      for (const { previous, current } of comparisons) {
        expect(previous.evidence).toBe("newer");
        if (current.evidence === "older") {
          return yield* new FileError({
            code: "ObservationExpired",
            message: "The file changed while it was being checked.",
          });
        }
        expect(current.evidence).toBe("fresh");
      }
      return comparisons.map(() => "same" as const);
    }),
  );
  await run(
    Effect.gen(function* () {
      const files = yield* Files;
      const [recorded] = yield* files.remember([
        observation("object", "current.txt", "local", "newer"),
      ]);
      const expired = yield* files
        .remember([observation("object", "old.txt", "local", "older")])
        .pipe(Effect.flip);
      expect(expired.code).toBe("ObservationExpired");
      expect(yield* files.get(recorded!.id)).toEqual(recorded);
      const [fresh] = yield* files.remember([observation("object", "fresh.txt", "local", "fresh")]);
      expect(fresh!.id).toBe(recorded!.id);
      expect(yield* files.get(recorded!.id)).toEqual(fresh);
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
