import { TestClock } from "effect/testing";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workspaces, WorkspaceError } from "@stargeist/domain";
import { Cause, Effect, Layer, Logger, References, Schema } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { Database, sqliteLayer } from "../index";
import { workspacesLayer } from "./index";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-repository-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const layer = workspacesLayer.pipe(
    Layer.provideMerge(sqliteLayer({ filename: join(root, "stargeist.sqlite") })),
  );

  const folder = { kind: "local-fs" as const, path: root };

  return { layer: layer.pipe(Layer.provideMerge(TestClock.layer())), folder };
}

describe("workspace persistence", () => {
  it("remembers workspace names after reopening the database", async () => {
    const { layer, folder } = await createFixture();
    const { workspace: saved } = await Effect.runPromise(
      Workspaces.use((repository) =>
        repository.create({ displayName: "Footage", source: folder }),
      ).pipe(Effect.provide(layer)),
    );

    expect(saved).toMatchObject({ displayName: "Footage", createdAt: 0 });

    const loaded = await Effect.runPromise(
      Workspaces.use((repository) => repository.get(saved.id)).pipe(Effect.provide(layer)),
    );

    expect(loaded).toEqual(saved);
  });

  it("logs the original database failure and returns a safe public error", async () => {
    const { layer } = await createFixture();
    const entries: Array<{ cause: Cause.Cause<unknown>; operation: unknown }> = [];
    const logger = Logger.make(({ cause, fiber }) => {
      entries.push({ cause, operation: fiber.getRef(References.CurrentLogAnnotations).operation });
    });

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const database = yield* Database;

        yield* database.run("DROP TABLE workspaces");

        const repository = yield* Workspaces;

        return yield* repository.list.pipe(Effect.flip);
      }).pipe(Effect.provide(layer), Effect.provide(Logger.layer([logger]))),
    );

    expect(Schema.encodeSync(WorkspaceError)(error)).toEqual({
      _tag: "WorkspaceError",
      code: "StorageUnavailable",
      message: "Workspace records could not be read or saved. Try again.",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.operation).toBe("workspaces.list");
    expect(Cause.pretty(entries[0]!.cause)).toContain("no such table: workspaces");
  });
});

it("rolls back the workspace when its first library fails, then permits a clean retry", async () => {
  const { layer, folder } = await createFixture();

  await Effect.runPromise(
    Effect.gen(function* () {
      const database = yield* Database;
      const repository = yield* Workspaces;

      yield* database.run(
        "CREATE TRIGGER fail_library BEFORE INSERT ON libraries BEGIN SELECT RAISE(ABORT, 'library write failed'); END",
      );

      expect(
        yield* repository.create({ displayName: "Footage", source: folder }).pipe(Effect.flip),
      ).toMatchObject({
        code: "StorageUnavailable",
      });
      expect(yield* repository.list).toEqual([]);
      expect(yield* database.all("SELECT id FROM libraries")).toEqual([]);

      yield* database.run("DROP TRIGGER fail_library");

      const created = yield* repository.create({ displayName: "Footage", source: folder });

      expect(created.library.workspaceId).toBe(created.workspace.id);
      expect(created.library.displayName).toBe(created.workspace.displayName);
      expect(yield* repository.list).toEqual([created.workspace]);
    }).pipe(Effect.provide(layer)),
  );
});
