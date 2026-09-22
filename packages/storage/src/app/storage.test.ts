import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileReference, Files } from "@stargeist/domain";
import { Effect, Layer } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppStorage, filesLayer } from "../index";

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "stargeist-profiles-")));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  return root;
}

it("binds and inspects a profile without creating storage or opening a database", async () => {
  const root = await fixture();
  const profile = join(root, "profile");
  const storage = await Effect.runPromise(
    AppStorage.pipe(Effect.provide(AppStorage.layer(profile))),
  );
  expect(storage.profile).toBe(profile);
  expect(storage.inspectWorkspaces()).toEqual([]);
  expect(await readdir(root)).toEqual([]);
});

it("keeps persistent file identities isolated between profiles and stable when reopened", async () => {
  const root = await fixture();
  const remember = (profile: string) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const files = yield* Files;
        const [file] = yield* files.ensure([
          FileReference.make({
            source: "source",
            key: "object",
          }),
        ]);
        return file!.id;
      }).pipe(
        Effect.provide(
          filesLayer.pipe(
            Layer.provide(AppStorage.database),
            Layer.provide(AppStorage.layer(profile)),
          ),
        ),
      ),
    );
  const first = join(root, "first");
  const second = join(root, "second");
  const [firstId, secondId] = await Promise.all([remember(first), remember(second)]);
  expect(firstId).not.toBe(secondId);
  expect(await remember(first)).toBe(firstId);
  expect(await remember(second)).toBe(secondId);
});

it("resets only its data and interrupted cleanup while preserving other profile state", async () => {
  const root = await fixture();
  const storage = AppStorage.at(join(root, "profile"));
  const other = AppStorage.at(join(root, "other"));
  for (const path of [storage.directory, storage.quarantine, other.directory]) {
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "keep.txt"), "data");
  }
  await writeFile(join(storage.profile, "Preferences"), "browser state");
  expect(storage.inspect()).toEqual({ exists: true, cleanupPending: true });
  expect(storage.reset()).toEqual({ status: "reset-complete" });
  expect(storage.inspect()).toEqual({ exists: false, cleanupPending: false });
  expect(await readdir(storage.profile)).toEqual(["Preferences"]);
  expect(await readFile(join(other.directory, "keep.txt"), "utf8")).toBe("data");
  expect(storage.reset()).toEqual({ status: "already-empty" });
});

it("rejects redirected data, quarantine, and profile ancestors before inspecting or removing data", async () => {
  const root = await fixture();
  const outside = join(root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "keep.txt"), "preserved");
  const profile = join(root, "profile");
  await mkdir(profile);
  const storage = AppStorage.at(profile);
  for (const path of [storage.directory, storage.quarantine]) {
    await symlink(outside, path, "junction");
    expect(() => storage.inspectWorkspaces()).toThrow(/ordinary directory/);
    expect(() => storage.reset()).toThrow(/ordinary directory/);
    await rm(path);
  }
  const alias = join(root, "alias");
  await symlink(root, alias, "junction");
  const redirected = AppStorage.at(join(alias, "profile"));
  expect(() => redirected.inspectWorkspaces()).toThrow(/redirected/);
  expect(() => redirected.reset()).toThrow(/redirected/);
  expect(await readFile(join(outside, "keep.txt"), "utf8")).toBe("preserved");
});
