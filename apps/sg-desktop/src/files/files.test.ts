import { copyFile, link, mkdir, mkdtemp, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, Schema } from "effect";
import { directoryPageSize, Files, FileKindMetadata } from "@stargeist/domain";
import { expect, it, onTestFinished } from "vite-plus/test";
import { AppStorage, temporaryStorageLayer, WorkspaceStorage } from "@stargeist/storage";
import { openDirectorySession } from "../filesystem";
import { BackendApplication } from "../backend/application";

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "stargeist-files-"));
  onTestFinished(() => rm(base, { recursive: true, force: true }));
  const root = join(base, "workspace");
  await mkdir(root);
  await Effect.runPromise(WorkspaceStorage.at(root).initialize);
  const layer = Layer.merge(BackendApplication.layer, temporaryStorageLayer).pipe(
    Layer.provide(AppStorage.layer(join(base, "profile"))),
  );
  const readFiles = (path = root) =>
    openDirectorySession(path, { exclude: new Set([".stargeist"]) }).pipe(
      Effect.map((readFiles) => readFiles.firstPage.files),
      Effect.scoped,
      Effect.provide(layer),
    );
  return { base, root, layer, list: (path = root) => Effect.runPromise(readFiles(path)) };
}

it("keeps a path's ID through replacement and gives copies and moved paths new IDs", async () => {
  const { root, list } = await fixture();
  await writeFile(join(root, "photo.JPG"), "original");
  await link(join(root, "photo.JPG"), join(root, "alias.jpg"));
  await symlink("photo.JPG", join(root, "shortcut.jpg"));
  await mkdir(join(root, "folder.pdf"));

  const first = await list();
  const original = first.find((file) => file.name === "photo.JPG")!;
  expect(original).toMatchObject({
    kind: "image",
    id: expect.stringMatching(/^fil_/),
  });
  expect(first.find((file) => file.name === "alias.jpg")?.id).not.toBe(original.id);
  expect(first.find((file) => file.name === "shortcut.jpg")).toMatchObject({
    kind: "link",
  });
  expect(first.find((file) => file.name === "folder.pdf")).toMatchObject({
    kind: "folder",
  });
  expect(first.some((file) => file.name === ".stargeist")).toBe(false);

  await writeFile(join(root, "replacement"), "replacement");
  await rename(join(root, "replacement"), join(root, "photo.JPG"));
  expect((await list()).find((file) => file.name === "photo.JPG")?.id).toBe(original.id);

  await rename(join(root, "photo.JPG"), join(root, "renamed.jpg"));
  await copyFile(join(root, "renamed.jpg"), join(root, "copy.jpg"));
  const afterRename = await list();
  const renamed = afterRename.find((file) => file.name === "renamed.jpg")!;
  expect(renamed.id).not.toBe(original.id);
  expect(afterRename.find((file) => file.name === "copy.jpg")?.id).not.toBe(renamed.id);
  expect(afterRename.find((file) => file.name === "alias.jpg")?.id).toBe(
    first.find((file) => file.name === "alias.jpg")?.id,
  );
});

it("shares IDs when the same path is browsed through overlapping workspaces", async () => {
  const { root, list } = await fixture();
  const nested = join(root, "nested");
  await mkdir(nested);
  await Effect.runPromise(WorkspaceStorage.at(nested).initialize);
  await writeFile(join(nested, "notes.txt"), "notes");
  const first = (await list(nested))[0]!;
  const second = (await list(nested))[0]!;
  expect(second.id).toBe(first.id);
});

it("persists kind beyond a directory session and refreshes it without replacing other metadata", async () => {
  const { root, list, layer } = await fixture();
  const path = join(root, "photo.jpg");
  await writeFile(path, "photo");
  const [original] = await list();
  const Note = { key: "test.note", schema: Schema.String };
  const run = <A, E>(effect: Effect.Effect<A, E, Files>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));

  await run(
    Effect.gen(function* () {
      const { metadata } = yield* Files;
      expect(yield* metadata.read(FileKindMetadata, [original!.id])).toEqual(
        new Map([[original!.id, "image"]]),
      );
      yield* metadata.write(Note, new Map([[original!.id, "Keep me"]]));
    }),
  );
  await rm(path);
  await mkdir(path);
  const [updated] = await list();
  expect(updated).toMatchObject({ id: original!.id, kind: "folder" });
  await rm(path, { recursive: true });
  await run(
    Effect.gen(function* () {
      const { metadata } = yield* Files;
      expect(yield* metadata.read(FileKindMetadata, [original!.id])).toEqual(
        new Map([[original!.id, "folder"]]),
      );
      expect(yield* metadata.read(Note, [original!.id])).toEqual(
        new Map([[original!.id, "Keep me"]]),
      );
    }),
  );
});

it("assigns matching IDs when full initial pages open concurrently", async () => {
  const { root, layer } = await fixture();
  for (let index = 0; index < directoryPageSize; index++)
    await writeFile(join(root, `file-${index}.txt`), "");
  const [first, second] = await Effect.runPromise(
    Effect.all(
      [
        openDirectorySession(root, { exclude: new Set([".stargeist"]) }),
        openDirectorySession(root, { exclude: new Set([".stargeist"]) }),
      ],
      { concurrency: 2 },
    ).pipe(
      Effect.map(([first, second]) => [first.firstPage.files, second.firstPage.files] as const),
      Effect.scoped,
      Effect.provide(layer),
    ),
  );
  expect(first).toHaveLength(directoryPageSize);
  expect(new Map(first.map((file) => [file.name, file.id]))).toEqual(
    new Map(second.map((file) => [file.name, file.id])),
  );
}, 15000);
