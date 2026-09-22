import {
  appendFile,
  copyFile,
  link,
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, Exit, Scope } from "effect";
import { directoryPageSize, Files } from "@stargeist/domain";
import { expect, it, onTestFinished } from "vite-plus/test";
import { pathsLayer, temporaryStorageLayer } from "../storage";
import { openListing } from "../filesystem";
import { BackendApplication } from "../backend/application";
import { workspaceRoots } from "@stargeist/workspace-storage";

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), "stargeist-file-identities-"));
  onTestFinished(() => rm(base, { recursive: true, force: true }));
  const root = join(base, "workspace");
  await mkdir(root);
  await Effect.runPromise(workspaceRoots.initialize(root));
  const layer = Layer.merge(BackendApplication.layer, temporaryStorageLayer).pipe(
    Layer.provide(pathsLayer(join(base, "profile"))),
  );
  const listing = (path = root) =>
    openListing(path, { exclude: new Set([".stargeist"]) }).pipe(
      Effect.map((listing) => listing.firstPage.files),
      Effect.scoped,
      Effect.provide(layer),
    );
  return { base, root, layer, listing, list: (path = root) => Effect.runPromise(listing(path)) };
}

it("persists object IDs across reopen, edits and renames while distinguishing copies and replacements", async () => {
  const { root, list } = await fixture();
  await writeFile(join(root, "photo.JPG"), "original");
  await link(join(root, "photo.JPG"), join(root, "alias.jpg"));
  await symlink("photo.JPG", join(root, "shortcut.jpg"));
  await mkdir(join(root, "folder.pdf"));

  const first = await list();
  const original = first.find((file) => file.name === "photo.JPG")!;
  expect(original).toMatchObject({
    type: "file",
    mediaType: "image/jpeg",
    id: expect.stringMatching(/^fil_/),
  });
  expect(first.find((file) => file.name === "alias.jpg")?.id).toBe(original.id);
  const shortcut = first.find((file) => file.name === "shortcut.jpg")!;
  expect(shortcut).toMatchObject({ type: "link", mediaType: null });
  expect(shortcut.id).not.toBe(original.id);
  expect(first.find((file) => file.name === "folder.pdf")).toMatchObject({
    type: "folder",
    mediaType: null,
  });
  expect(first.some((file) => file.name === ".stargeist")).toBe(false);

  await appendFile(join(root, "photo.JPG"), " edited");
  await rename(join(root, "photo.JPG"), join(root, "renamed.jpg"));
  await copyFile(join(root, "renamed.jpg"), join(root, "copy.jpg"));
  const afterRename = await list();
  expect(afterRename.find((file) => file.name === "renamed.jpg")?.id).toBe(original.id);
  expect(afterRename.find((file) => file.name === "copy.jpg")?.id).not.toBe(original.id);
  expect(afterRename.find((file) => file.name === "shortcut.jpg")?.id).toBe(shortcut.id);

  await writeFile(join(root, "replacement"), "replacement");
  await rename(join(root, "replacement"), join(root, "renamed.jpg"));
  const replaced = await list();
  const replacementId = replaced.find((file) => file.name === "renamed.jpg")?.id;
  expect(replacementId).not.toBe(original.id);
  expect(replaced.find((file) => file.name === "alias.jpg")?.id).toBe(original.id);
  expect((await list()).find((file) => file.name === "renamed.jpg")?.id).toBe(replacementId);
});

it("shares IDs across moved, nested and overlapping workspace views", async () => {
  const { base, root, list } = await fixture();
  await writeFile(join(root, "notes.txt"), "notes");
  const original = (await list()).find((file) => file.name === "notes.txt")!;
  const moved = join(base, "moved");
  await rename(root, moved);
  expect((await list(moved)).find((file) => file.name === "notes.txt")?.id).toBe(original.id);

  const nested = join(moved, "nested");
  await mkdir(nested);
  await Effect.runPromise(workspaceRoots.initialize(nested));
  await link(join(moved, "notes.txt"), join(nested, "notes.txt"));
  const child = (await list(nested)).find((file) => file.name === "notes.txt")!;
  expect(child.id).toBe(original.id);
  expect((await list(moved)).filter((file) => file.name === "notes.txt")).toHaveLength(1);
});

it("assigns matching IDs when full initial pages open concurrently", async () => {
  const { root, layer } = await fixture();
  for (let index = 0; index < directoryPageSize; index++)
    await writeFile(join(root, `file-${index}.txt`), "");
  const [first, second] = await Effect.runPromise(
    Effect.all(
      [
        openListing(root, { exclude: new Set([".stargeist"]) }),
        openListing(root, { exclude: new Set([".stargeist"]) }),
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
  expect(new Set(first.map((file) => file.id)).size).toBe(directoryPageSize);
});

it("retains remembered file descriptions after listing closure and source removal", async () => {
  const { root, layer } = await fixture();
  await writeFile(join(root, "notes.txt"), "notes");
  await Effect.runPromise(
    Effect.gen(function* () {
      const files = yield* Files;
      const scope = yield* Scope.fork(yield* Effect.scope);
      const listing = yield* openListing(root, { exclude: new Set([".stargeist"]) }).pipe(
        Scope.provide(scope),
      );
      const observed = listing.firstPage.files[0]!;
      yield* Scope.close(scope, Exit.void);
      yield* Effect.promise(() => rm(root, { recursive: true }));
      expect(yield* files.get(observed.id)).toEqual(observed);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );
});
