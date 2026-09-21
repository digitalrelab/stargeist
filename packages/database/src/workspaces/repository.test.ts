import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError } from "@stargeist/domain/workspaces";
import { WorkspaceRepository } from "@stargeist/domain/workspaces/repository";
import { Cause, Effect, Layer, Logger, References, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { sqliteLayer } from "../index";
import { repositoryLayer } from "./index";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-repository-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const layer = repositoryLayer.pipe(
    Layer.provideMerge(sqliteLayer({ filename: join(root, "stargeist.sqlite") })),
  );
  const folder = { rootPath: root, identity: "test-folder", name: "Project" };

  return { layer, folder };
}

describe("workspace persistence", () => {
  it("remembers records after closing and reopening the database", async () => {
    const { layer, folder } = await createFixture();
    const created = await Effect.runPromise(
      WorkspaceRepository.use((repository) => repository.register(folder, 1)).pipe(
        Effect.provide(layer),
      ),
    );

    const saved = await Effect.runPromise(
      WorkspaceRepository.use((repository) => repository.get(created.id)).pipe(
        Effect.provide(layer),
      ),
    );

    expect(saved).toEqual(created);
  });

  it("updates a known folder without replacing its ID or creation time", async () => {
    const { layer, folder } = await createFixture();
    const relocated = { ...folder, rootPath: join(folder.rootPath, "renamed"), name: "Renamed" };

    await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* WorkspaceRepository;
        const created = yield* repository.register(folder, 1);
        const reopened = yield* repository.register(relocated, 2);

        expect(reopened).toEqual({
          id: created.id,
          name: "Renamed",
          rootPath: relocated.rootPath,
          createdAt: 1,
          openedAt: 2,
        });
        expect(yield* repository.list).toEqual([reopened]);
      }).pipe(Effect.provide(layer)),
    );
  });

  it("logs the original database failure and returns a safe public error", async () => {
    const { layer } = await createFixture();
    const entries: Array<{ cause: Cause.Cause<unknown>; operation: unknown }> = [];
    const logger = Logger.make(({ cause, fiber }) => {
      entries.push({ cause, operation: fiber.getRef(References.CurrentLogAnnotations).operation });
    });

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        yield* sql`DROP TABLE workspaces`;

        const repository = yield* WorkspaceRepository;
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
