import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { WorkspaceStorage } from "../index";

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "stargeist-roots-")));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, "archive");
  await mkdir(join(folder, "film", "raw"), { recursive: true });
  const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);
  return { root, folder, run };
}

it("initializes once under concurrent callers and discovers the nearest nested root", async () => {
  const { folder, run } = await fixture();
  await run(
    Effect.gen(function* () {
      const [parent, again] = yield* Effect.all(
        [WorkspaceStorage.at(folder).initialize, WorkspaceStorage.at(folder).initialize],
        { concurrency: "unbounded" },
      );
      expect(parent).toEqual(again);
      expect((yield* WorkspaceStorage.discover(join(folder, "film", "raw")))?.identity).toBe(
        parent.identity,
      );
      const child = yield* WorkspaceStorage.at(join(folder, "film")).initialize;
      expect(child.identity).not.toBe(parent.identity);
      expect((yield* WorkspaceStorage.discover(join(folder, "film", "raw")))?.identity).toBe(
        child.identity,
      );
      expect((yield* WorkspaceStorage.at(folder).read).identity).toBe(parent.identity);
    }),
  );
  expect((await readdir(join(folder, ".stargeist"))).sort()).toEqual(["workspace.json"]);
});

it("preserves identity after a move or copy and resolves symlink aliases", async () => {
  const { root, folder, run } = await fixture();
  const original = await run(WorkspaceStorage.at(folder).initialize);
  const moved = join(root, "moved");
  await rename(folder, moved);
  const copied = join(root, "copied");
  await cp(moved, copied, { recursive: true });
  const alias = join(root, "alias");
  await symlink(moved, alias, "dir");
  await run(
    Effect.gen(function* () {
      expect(yield* WorkspaceStorage.at(alias).read).toEqual({
        identity: original.identity,
        createdAt: original.createdAt,
        root: moved,
      });
      expect(yield* WorkspaceStorage.at(copied).read).toEqual({
        identity: original.identity,
        createdAt: original.createdAt,
        root: copied,
      });
      expect(yield* WorkspaceStorage.at(folder).read.pipe(Effect.flip)).toMatchObject({
        code: "FolderUnavailable",
      });
    }),
  );
  const manifest = JSON.parse(await readFile(join(moved, ".stargeist", "workspace.json"), "utf8"));
  expect(Object.keys(manifest).sort()).toEqual(["createdAt", "id"]);
});

it.each([
  ["{", "InvalidWorkspace"],
  [JSON.stringify({ id: "invalid", createdAt: 1 }), "InvalidWorkspace"],
  [" ".repeat(65537), "InvalidWorkspace"],
])(
  "rejects invalid metadata without overwriting it or falling back to a parent",
  async (contents, code) => {
    const { folder, run } = await fixture();
    await run(WorkspaceStorage.at(folder).initialize);
    const child = join(folder, "film");
    await mkdir(join(child, ".stargeist"));
    const manifest = join(child, ".stargeist", "workspace.json");
    await writeFile(manifest, contents);
    await run(
      Effect.gen(function* () {
        expect(
          yield* WorkspaceStorage.discover(join(child, "raw")).pipe(Effect.flip),
        ).toMatchObject({ code });
        expect(yield* WorkspaceStorage.at(child).initialize.pipe(Effect.flip)).toMatchObject({
          code,
        });
      }),
    );
    expect(await readFile(manifest, "utf8")).toBe(contents);
  },
);

it("allows explicit recovery of an empty initialization but does not initialize during discovery", async () => {
  const { folder, run } = await fixture();
  await mkdir(join(folder, ".stargeist"));
  await run(
    Effect.gen(function* () {
      expect(yield* WorkspaceStorage.discover(folder).pipe(Effect.flip)).toMatchObject({
        code: "InvalidWorkspace",
      });
      const initialized = yield* WorkspaceStorage.at(folder).initialize;
      expect(yield* WorkspaceStorage.at(folder).read).toEqual(initialized);
    }),
  );
});

it("offers reset or restore for obsolete metadata without changing it", async () => {
  const { folder, run } = await fixture();
  await run(WorkspaceStorage.at(folder).initialize);
  const filename = join(folder, ".stargeist", "workspace.json");
  const current = JSON.parse(await readFile(filename, "utf8"));
  const previous = JSON.stringify({ ...current, formatVersion: 1 });
  await writeFile(filename, previous);
  expect(await run(WorkspaceStorage.at(folder).read.pipe(Effect.flip))).toMatchObject({
    code: "InvalidWorkspace",
    message: "This workspace needs to be reset or restored.",
  });
  expect(await readFile(filename, "utf8")).toBe(previous);
});

it("rejects redirected metadata and non-directory roots", async () => {
  const { root, folder, run } = await fixture();
  const outside = join(root, "outside");
  await mkdir(outside);
  await symlink(outside, join(folder, ".stargeist"), "dir");
  const file = join(root, "file");
  await writeFile(file, "content");
  await run(
    Effect.gen(function* () {
      expect(yield* WorkspaceStorage.at(folder).initialize.pipe(Effect.flip)).toMatchObject({
        code: "InvalidWorkspace",
      });
      expect(yield* WorkspaceStorage.discover(file).pipe(Effect.flip)).toMatchObject({
        code: "FolderUnavailable",
      });
    }),
  );
  expect(await readdir(outside)).toEqual([]);
});

it("preserves unrelated metadata when initialization is incomplete", async () => {
  const { folder, run } = await fixture();
  await mkdir(join(folder, ".stargeist"));
  const existing = join(folder, ".stargeist", "notes.json");
  await writeFile(existing, "important");
  await run(
    WorkspaceStorage.at(folder).initialize.pipe(
      Effect.flip,
      Effect.tap((error) => Effect.sync(() => expect(error.code).toBe("InvalidWorkspace"))),
    ),
  );
  expect(await readFile(existing, "utf8")).toBe("important");
  expect(await readdir(join(folder, ".stargeist"))).toEqual(["notes.json"]);
});

it.runIf(process.platform !== "win32" && process.getuid?.() !== 0)(
  "opens read-only workspaces and reports unwritable initialization without partial metadata",
  async () => {
    const { folder, run } = await fixture();
    const workspace = await run(WorkspaceStorage.at(folder).initialize);
    const uninitialized = join(folder, "film", "raw");
    await chmod(folder, 0o555);
    await chmod(uninitialized, 0o555);
    try {
      await run(
        Effect.gen(function* () {
          expect(yield* WorkspaceStorage.at(folder).read).toEqual(workspace);
          expect(yield* WorkspaceStorage.at(folder).initialize).toEqual(workspace);
          expect(
            yield* WorkspaceStorage.at(uninitialized).initialize.pipe(Effect.flip),
          ).toMatchObject({
            code: "StorageUnavailable",
          });
        }),
      );
      expect(await readdir(uninitialized)).toEqual([]);
    } finally {
      await chmod(folder, 0o755);
      await chmod(uninitialized, 0o755);
    }
  },
);
