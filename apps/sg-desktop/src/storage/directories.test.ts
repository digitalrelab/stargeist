import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppDirectories, directoriesLayer } from "./index";

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
      const directories = yield* AppDirectories;
      const names = yield* Effect.promise(() => readdir(temporary));

      expect(names).not.toContain(orphan);
      expect(names).toContain(active);
      expect(names).toContain("unrelated");
      expect(names).toHaveLength(3);
      expect(directories.data).toBe(join(profile, "data"));
    }).pipe(Effect.provide(directoriesLayer(profile))),
  );

  expect(await readdir(temporary)).toEqual([active, "unrelated"].sort());
});
