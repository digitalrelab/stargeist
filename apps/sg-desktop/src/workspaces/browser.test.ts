import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError, Workspace, makeWorkspaceId } from "@stargeist/domain";
import { Layer, Effect, Exit, Scope } from "effect";
import { describe, expect, it, onTestFinished } from "vite-plus/test";
import {
  TemporaryStorage,
  AppStorage,
  temporaryStorageLayer,
  WorkspaceStorage,
} from "@stargeist/storage";
import { BackendApplication } from "../backend/application";
import { makeWorkspaceBrowser } from "./browser";

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "stargeist-workspace-browser-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  await Effect.runPromise(WorkspaceStorage.at(root).initialize);
  const workspace = new Workspace({ id: Effect.runSync(makeWorkspaceId), root });
  return {
    workspace,
    root,
    layer: Layer.merge(BackendApplication.layer, temporaryStorageLayer).pipe(
      Layer.provide(AppStorage.layer(join(root, "profile"))),
    ),
  };
}

describe("active workspace browser", () => {
  it("releases failed acquisitions without leaving temporary files", async () => {
    const { root, workspace, layer } = await createFixture();

    await Effect.runPromise(
      Effect.gen(function* () {
        const paths = yield* TemporaryStorage;
        const browser = yield* makeWorkspaceBrowser({
          get: () =>
            Effect.succeed(new Workspace({ id: workspace.id, root: join(root, "missing") })),
        });
        const error = yield* browser.browse(workspace.id).pipe(Effect.flip);

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
        const browser = yield* makeWorkspaceBrowser({ get: () => Effect.succeed(workspace) }).pipe(
          Scope.provide(scope),
        );
        const firstScope = yield* Scope.fork(yield* Effect.scope);
        const first = (yield* browser.browse(workspace.id).pipe(Scope.provide(firstScope)))
          .directory;
        const second = (yield* browser.browse(workspace.id)).directory;

        expect(second.directorySessionId).not.toBe(first.directorySessionId);
        expect(yield* Effect.promise(() => readdir(paths.directory))).toHaveLength(1);
        expect((yield* browser.read(first.directorySessionId, 0).pipe(Effect.flip)).code).toBe(
          "DirectorySessionExpired",
        );

        yield* Scope.close(firstScope, Exit.void);
        expect(yield* browser.read(second.directorySessionId, 0)).toEqual(second);

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
        const browser = yield* makeWorkspaceBrowser({ get: () => Effect.succeed(workspace) });
        const viewScope = yield* Scope.fork(yield* Effect.scope);
        const page = (yield* browser.browse(workspace.id).pipe(Scope.provide(viewScope))).directory;

        yield* Scope.close(viewScope, Exit.void);

        expect((yield* browser.read(page.directorySessionId, 0).pipe(Effect.flip)).code).toBe(
          "DirectorySessionExpired",
        );
        expect(yield* Effect.promise(() => readdir(paths.directory))).toEqual([]);
      }).pipe(Effect.scoped, Effect.provide(layer)),
    );
  });
});
