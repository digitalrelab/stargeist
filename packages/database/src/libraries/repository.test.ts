import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceId } from "@stargeist/domain/workspaces";
import { WorkspaceRepository } from "@stargeist/domain/workspaces/repository";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { sqliteLayer } from "../index";
import { repositoryLayer } from "./index";
import { repositoryLayer as workspaceLayer } from "../workspaces";
import { LibraryRepository } from "@stargeist/domain/libraries/repository";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-repository-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const layer = Layer.merge(repositoryLayer, workspaceLayer).pipe(
    Layer.provideMerge(sqliteLayer({ filename: join(root, "stargeist.sqlite") })),
  );

  const folder = { kind: "local-fs" as const, path: root };

  return { layer, folder };
}

describe("library persistence", () => {
  it("persists a workspace and its libraries after reopening the database", async () => {
    const { layer, folder } = await createFixture();
    const saved = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* WorkspaceRepository;

        const libraries = yield* LibraryRepository;
        const { workspace, library: first } = yield* repository.create("Documentary", folder, 1);
        expect(workspace).toEqual({
          id: expect.any(String),
          displayName: "Documentary",
          createdAt: 1,
        });
        expect(yield* libraries.list(workspace.id)).toEqual([first]);
        const second = yield* libraries.add(
          workspace.id,
          { ...folder, path: join(folder.path, "archive") },
          "Archive",
          3,
        );
        expect(first).toEqual({
          id: expect.any(String),
          workspaceId: workspace.id,
          displayName: "Documentary",
          source: { kind: "local-fs", path: folder.path },
          createdAt: 1,
        });
        expect(second.id).not.toBe(first.id);

        return { workspace, libraries: [first, second] };
      }).pipe(Effect.provide(layer)),
    );
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* WorkspaceRepository;

        const libraries = yield* LibraryRepository;
        expect(yield* repository.get(saved.workspace.id)).toEqual(saved.workspace);
        expect(yield* libraries.list(saved.workspace.id)).toEqual(saved.libraries);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("allows repeated and overlapping sources without merging library or workspace identities", async () => {
    const { layer, folder } = await createFixture();
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* WorkspaceRepository;

        const libraries = yield* LibraryRepository;
        const { workspace: a, library: first } = yield* repository.create("A", folder, 1);
        const { workspace: b, library: shared } = yield* repository.create("B", folder, 2);
        const repeated = yield* libraries.add(a.id, folder, "Another view", 4);
        const nested = yield* libraries.add(
          b.id,
          { ...folder, path: join(folder.path, "nested") },
          "Nested",
          6,
        );
        expect(new Set([first.id, repeated.id, shared.id, nested.id]).size).toBe(4);
        expect(shared.source).toEqual(first.source);
        expect(yield* libraries.list(a.id)).toEqual([first, repeated]);
        expect(yield* libraries.list(b.id)).toEqual([shared, nested]);
        expect(
          yield* libraries.get({ workspaceId: b.id, id: first.id }).pipe(Effect.flip),
        ).toMatchObject({ code: "NotFound" });
      }).pipe(Effect.provide(layer)),
    );
  });

  it("rejects orphan libraries and distinguishes a missing workspace from an empty one", async () => {
    const { layer, folder } = await createFixture();
    const missing = Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001");
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* WorkspaceRepository;

        const libraries = yield* LibraryRepository;
        expect(yield* libraries.add(missing, folder, "Orphan", 1).pipe(Effect.flip)).toMatchObject({
          code: "NotFound",
        });
        expect(yield* libraries.list(missing).pipe(Effect.flip)).toMatchObject({
          code: "NotFound",
        });
        expect(yield* repository.list).toEqual([]);
      }).pipe(Effect.provide(layer)),
    );
  });
});
