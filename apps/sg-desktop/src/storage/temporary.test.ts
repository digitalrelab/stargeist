import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { Layer, Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { TemporaryStorage, pathsLayer, temporaryStorageLayer } from "./index";

it("reclaims abandoned sessions while preserving live sessions and unrelated directories", async () => {
  const profile = await mkdtemp(join(tmpdir(), "stargeist-storage-test-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));

  const { stdout } = await promisify(execFile)(process.execPath, [
    "-e",
    "process.stdout.write(String(process.pid))",
  ]);
  const temporary = join(profile, "temporary");
  const orphan = `session-${stdout}-abandoned`;
  const active = `session-${process.pid}-active`;

  await Promise.all(
    [orphan, active, "unrelated"].map((name) => mkdir(join(temporary, name), { recursive: true })),
  );

  await Effect.runPromise(
    Effect.gen(function* () {
      const directories = yield* TemporaryStorage;
      const names = yield* Effect.promise(() => readdir(temporary));

      expect(names).not.toContain(orphan);
      expect(names).toContain(active);
      expect(names).toContain("unrelated");
      expect(names).toHaveLength(3);
      expect(names).toContain(basename(directories.directory));
    }).pipe(Effect.provide(temporaryStorageLayer.pipe(Layer.provide(pathsLayer(profile))))),
  );

  expect(await readdir(temporary)).toEqual([active, "unrelated"].sort());
});

it("cleans a failed session without deleting another session or persistent data", async () => {
  const profile = await mkdtemp(join(tmpdir(), "stargeist-storage-test-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));
  const data = join(profile, "data");
  await mkdir(data);
  const database = join(data, "stargeist.sqlite");
  await writeFile(database, "persistent data");
  const layer = temporaryStorageLayer.pipe(Layer.provide(pathsLayer(profile)));
  const failure = new Error("session failed");

  await Effect.runPromise(
    Effect.gen(function* () {
      const first = yield* TemporaryStorage;
      const firstFile = join(first.directory, "listing.sqlite");
      yield* Effect.promise(() => writeFile(firstFile, "active listing"));

      const error = yield* Effect.gen(function* () {
        const second = yield* TemporaryStorage;
        expect(second.directory).not.toBe(first.directory);
        yield* Effect.promise(() => writeFile(join(second.directory, "listing.sqlite"), "cache"));
        expect(yield* Effect.promise(() => readdir(join(profile, "temporary")))).toHaveLength(2);
        return yield* Effect.fail(failure);
      }).pipe(Effect.provide(Layer.fresh(layer)), Effect.flip);

      expect(error).toBe(failure);
      expect(yield* Effect.promise(() => readdir(join(profile, "temporary")))).toEqual([
        basename(first.directory),
      ]);
      expect(yield* Effect.promise(() => readFile(firstFile, "utf8"))).toBe("active listing");
    }).pipe(Effect.provide(layer)),
  );

  expect(await readdir(join(profile, "temporary"))).toEqual([]);
  expect(await readFile(database, "utf8")).toBe("persistent data");
});
