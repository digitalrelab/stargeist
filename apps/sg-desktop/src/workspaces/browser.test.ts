import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError, Workspace, makeWorkspaceId } from "@stargeist/domain";
import { Layer, Effect, Exit, Scope } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import { TemporaryStorage, pathsLayer, temporaryStorageLayer } from "../storage";
import { BackendApplication } from "../backend/application";
import { workspaceRoots } from "@stargeist/workspace-storage";
import { makeWorkspaceBrowser } from "./browser";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-workspace-listing-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Effect.runPromise(workspaceRoots.initialize(root));
  const workspace = new Workspace({ id: Effect.runSync(makeWorkspaceId), root });
  return {
    workspace,
    root,
    layer: Layer.merge(BackendApplication.layer, temporaryStorageLayer).pipe(
      Layer.provide(pathsLayer(join(root, "profile"))),
    ),
  };
}

describe("active workspace listing", () => {
  it("releases failed acquisitions without leaving temporary files", async () => {
    const { root, workspace, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const listing = yield* makeWorkspaceBrowser({
          get: () =>
            Effect.succeed(new Workspace({ id: workspace.id, root: join(root, "missing") })),
        });
        const error = yield* listing.browse(workspace.id).pipe(Effect.flip);

        expect(error).toBeInstanceOf(WorkspaceError);
        expect(error.code).toBe("FolderUnavailable");
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("expires replaced views without letting an older scope close the current view", async () => {
    const { workspace, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const scope = yield* Scope.fork(yield* Effect.scope);
        const listing = yield* makeWorkspaceBrowser({ get: () => Effect.succeed(workspace) }).pipe(
          Scope.provide(scope),
        );
        const firstScope = yield* Scope.fork(yield* Effect.scope);
        const first = (yield* listing.browse(workspace.id).pipe(Scope.provide(firstScope)))
          .directory;
        const second = (yield* listing.browse(workspace.id)).directory;

        expect(second.listingId).not.toBe(first.listingId);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toHaveLength(1);
        expect((yield* listing.read(first.listingId, 0).pipe(Effect.flip)).code).toBe(
          "ListingExpired",
        );

        yield* Scope.close(firstScope, Exit.void);
        expect(yield* listing.read(second.listingId, 0)).toEqual(second);

        yield* Scope.close(scope, Exit.void);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });

  it("expires explicitly closed views and removes their temporary files", async () => {
    const { workspace, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const listing = yield* makeWorkspaceBrowser({ get: () => Effect.succeed(workspace) });
        const viewScope = yield* Scope.fork(yield* Effect.scope);
        const page = (yield* listing.browse(workspace.id).pipe(Scope.provide(viewScope))).directory;

        yield* Scope.close(viewScope, Exit.void);

        expect((yield* listing.read(page.listingId, 0).pipe(Effect.flip)).code).toBe(
          "ListingExpired",
        );
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });
});
