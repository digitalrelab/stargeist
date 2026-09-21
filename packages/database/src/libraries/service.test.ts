import { TestClock } from "effect/testing";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceId, Workspaces, Libraries } from "@stargeist/domain";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { Database, sqliteLayer } from "../index";
import { libraries } from "./schema";
import { eq } from "drizzle-orm";
import { librariesLayer } from "./index";
import { workspacesLayer } from "../workspaces";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-repository-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const layer = Layer.merge(librariesLayer, workspacesLayer).pipe(
    Layer.provideMerge(sqliteLayer({ filename: join(root, "stargeist.sqlite") })),
  );

  const folder = { kind: "local-fs" as const, path: root };

  return { layer: layer.pipe(Layer.provideMerge(TestClock.layer())), folder };
}

describe("library persistence", () => {
  it("persists a workspace and its libraries after reopening the database", async () => {
    const { layer, folder } = await createFixture();
    const saved = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* Workspaces;

        const libraries = yield* Libraries;
        const { workspace, library: first } = yield* repository.create({
          displayName: "Documentary",
          source: folder,
        });
        expect(workspace).toEqual({
          id: expect.any(String),
          displayName: "Documentary",
          createdAt: 0,
        });
        expect(yield* libraries.list(workspace.id)).toEqual([first]);
        yield* TestClock.adjust(1);
        const second = yield* libraries.add({
          workspaceId: workspace.id,
          source: { ...folder, path: join(folder.path, "archive") },
          displayName: "Archive",
        });
        expect(first).toEqual({
          id: expect.any(String),
          workspaceId: workspace.id,
          displayName: "Documentary",
          source: { kind: "local-fs", path: folder.path },
          createdAt: 0,
        });
        expect(second.id).not.toBe(first.id);

        return { workspace, libraries: [first, second] };
      }).pipe(Effect.provide(layer)),
    );
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* Workspaces;

        const libraries = yield* Libraries;
        expect(yield* repository.get(saved.workspace.id)).toEqual(saved.workspace);
        expect(yield* libraries.list(saved.workspace.id)).toEqual(saved.libraries);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("allows repeated and overlapping sources without merging library or workspace identities", async () => {
    const { layer, folder } = await createFixture();
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* Workspaces;

        const libraries = yield* Libraries;
        const { workspace: a, library: first } = yield* repository.create({
          displayName: "A",
          source: folder,
        });
        const { workspace: b, library: shared } = yield* repository.create({
          displayName: "B",
          source: folder,
        });
        yield* TestClock.adjust(1);
        const repeated = yield* libraries.add({
          workspaceId: a.id,
          source: folder,
          displayName: "Another view",
        });
        yield* TestClock.adjust(1);
        const nested = yield* libraries.add({
          workspaceId: b.id,
          source: { ...folder, path: join(folder.path, "nested") },
          displayName: "Nested",
        });
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

  it("rejects malformed stored identities before exposing library records", async () => {
    const { layer, folder } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;
        const workspaces = yield* Workspaces;
        const repository = yield* Libraries;
        const { workspace, library } = yield* workspaces.create({
          displayName: "Footage",
          source: folder,
        });

        yield* database.insert(libraries).values({
          id: "invalid-library-id",
          workspaceId: workspace.id,
          displayName: "Invalid record",
          sourceKind: folder.kind,
          sourcePath: folder.path,
          createdAt: 2,
        });

        expect(yield* repository.list(workspace.id).pipe(Effect.flip)).toMatchObject({
          _tag: "LibraryError",
          code: "StorageUnavailable",
        });

        yield* database.delete(libraries).where(eq(libraries.id, "invalid-library-id"));

        expect(yield* repository.list(workspace.id)).toEqual([library]);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("rejects orphan libraries and distinguishes a missing workspace from an empty one", async () => {
    const { layer, folder } = await createFixture();
    const missing = Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001");
    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* Workspaces;

        const libraries = yield* Libraries;
        expect(
          yield* libraries
            .add({ workspaceId: missing, source: folder, displayName: "Orphan" })
            .pipe(Effect.flip),
        ).toMatchObject({
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
