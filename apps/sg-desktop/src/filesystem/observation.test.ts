import { mkdir, mkdtemp, rename, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Files } from "@stargeist/domain";
import { AppStorage } from "@stargeist/storage";
import { Effect, Layer } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { FilesModule } from "../files";
import { observeFile } from "./observation";

it("keeps saved file IDs through timestamp changes and moves, and preserves replaced records", async () => {
  const root = await mkdtemp(join(tmpdir(), "stargeist-observation-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const content = join(root, "content");
  await mkdir(content);
  await writeFile(join(content, "original.txt"), "original");
  const layer = FilesModule.layer.pipe(
    Layer.provide(AppStorage.database),
    Layer.provide(AppStorage.layer(join(root, "profile"))),
  );
  const remember = (name: string) =>
    Effect.gen(function* () {
      const observation = yield* observeFile(content, name);
      expect(observation).not.toBeNull();
      return (yield* (yield* Files).remember([observation!]))[0]!;
    });
  const run = <A, E>(effect: Effect.Effect<A, E, Files>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));
  const original = await run(remember("original.txt"));
  await utimes(join(content, "original.txt"), new Date("2000-01-01"), new Date("2000-01-01"));
  expect((await run(remember("original.txt"))).id).toBe(original.id);
  await rename(join(content, "original.txt"), join(content, "moved.txt"));
  const moved = await run(remember("moved.txt"));
  expect(moved.id).toBe(original.id);
  await writeFile(join(content, "replacement.txt"), "replacement");
  const incoming = await run(remember("replacement.txt"));
  await rename(join(content, "replacement.txt"), join(content, "moved.txt"));
  const replaced = await run(remember("moved.txt"));
  expect(replaced.id).toBe(incoming.id);
  expect(replaced.id).not.toBe(original.id);
  expect(await run(Effect.flatMap(Files, (files) => files.get(original.id)))).toEqual(moved);
});
