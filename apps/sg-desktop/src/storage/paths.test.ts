import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { StoragePaths, pathsLayer } from "./index";

it("resolves product paths without creating storage or acquiring a temporary session", async () => {
  const root = await mkdtemp(join(tmpdir(), "stargeist-paths-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const profile = join(root, "profile");

  const paths = await Effect.runPromise(StoragePaths.pipe(Effect.provide(pathsLayer(profile))));

  expect(paths).toEqual({
    profile,
    database: join(profile, "data", "workspaces.sqlite"),
    userPreferences: join(profile, "data", "user-preferences.json"),
    temporary: join(profile, "temporary"),
  });
  expect(await readdir(root)).toEqual([]);
});
