import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Files, Workspaces } from "@stargeist/domain";
import { Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "effect";
import { RpcClient, RpcServer, RpcTest } from "effect/unstable/rpc";
import { expect, it, onTestFinished } from "vite-plus/test";
import { BackendApplication } from "../backend/application";
import { TemporaryStorage, AppStorage, temporaryStorageLayer } from "@stargeist/storage";
import { WorkspaceControlEndpoint, WorkspaceEndpoint } from "./index";

it("opens, discovers, nests, reconnects and reopens workspaces through the real backend", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "stargeist-workspaces-")));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, "Archive");
  const film = join(archive, "Film");
  await mkdir(film, { recursive: true });
  await writeFile(join(film, "interview.txt"), "original");
  const profile = join(root, "profile");
  const run = <A, E>(
    effect: Effect.Effect<A, E, Workspaces | Files | TemporaryStorage | Scope.Scope>,
  ) =>
    Effect.runPromise(
      effect.pipe(
        Effect.scoped,
        Effect.provide(BackendApplication.layer),
        Effect.provide(temporaryStorageLayer.pipe(Layer.provideMerge(AppStorage.layer(profile)))),
      ),
    );
  const saved = await run(
    Effect.gen(function* () {
      const handlers = yield* Layer.build(
        Layer.merge(WorkspaceControlEndpoint.layer, WorkspaceEndpoint.layer),
      );
      const client = yield* RpcTest.makeClient(WorkspaceEndpoint.rpcs).pipe(
        Effect.provide(handlers),
      );
      const host = yield* RpcTest.makeClient(WorkspaceControlEndpoint.rpcs).pipe(
        Effect.provide(handlers),
      );
      expect(
        yield* host["workspaces.open"]({ path: join(root, "missing") }).pipe(Effect.flip),
      ).toMatchObject({ code: "FolderUnavailable" });
      expect(yield* client["workspaces.list"]()).toEqual([]);
      const [parent, duplicate] = yield* Effect.all(
        [host["workspaces.open"]({ path: archive }), host["workspaces.open"]({ path: archive })],
        { concurrency: 2 },
      );
      expect(duplicate).toEqual(parent);
      expect(yield* host["workspaces.open"]({ path: film })).toEqual(parent);
      const child = yield* host["workspaces.initialize"]({ path: film });
      expect(child.id).not.toBe(parent.id);
      expect(yield* host["workspaces.open"]({ path: film })).toEqual(child);
      const first = yield* client["workspaces.browse"]({ id: parent.id }).pipe(
        Stream.toPull,
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
      );
      expect(first.workspace).toEqual(parent);
      expect(first.directory.files).toMatchObject([
        { name: "Film", kind: "folder", id: expect.stringMatching(/^fil_/) },
      ]);
      const secondScope = yield* Scope.fork(yield* Effect.scope);
      const second = yield* client["workspaces.browse"]({ id: child.id }).pipe(
        Stream.toPull,
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
        Scope.provide(secondScope),
      );
      expect(second.directory.files).toMatchObject([
        {
          name: "interview.txt",
          kind: "text",
          id: expect.stringMatching(/^fil_/),
        },
      ]);
      expect(
        yield* client["workspaces.readDirectory"]({
          directorySessionId: first.directory.directorySessionId,
          offset: 0,
        }).pipe(Effect.flip),
      ).toMatchObject({ code: "DirectorySessionExpired" });
      yield* Scope.close(secondScope, Exit.void);
      expect(
        yield* client["workspaces.readDirectory"]({
          directorySessionId: second.directory.directorySessionId,
          offset: 0,
        }).pipe(Effect.flip),
      ).toMatchObject({ code: "DirectorySessionExpired" });
      const reopened = yield* client["workspaces.browse"]({ id: child.id }).pipe(
        Stream.toPull,
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
      );
      expect(reopened.directory.files).toEqual(second.directory.files);
      const copyPath = join(root, "Copy");
      yield* Effect.promise(() => cp(film, copyPath, { recursive: true }));
      const copy = yield* host["workspaces.open"]({ path: copyPath });
      expect(
        yield* Effect.promise(() =>
          readFile(join(copy.root, ".stargeist", "workspace.json"), "utf8"),
        ),
      ).toBe(
        yield* Effect.promise(() =>
          readFile(join(child.root, ".stargeist", "workspace.json"), "utf8"),
        ),
      );
      expect(copy.id).not.toBe(child.id);
      const otherHandlers = yield* Layer.build(WorkspaceEndpoint.layer);
      const otherRenderer = yield* RpcTest.makeClient(WorkspaceEndpoint.rpcs).pipe(
        Effect.provide(otherHandlers),
      );
      const independent = yield* otherRenderer["workspaces.browse"]({
        id: copy.id,
      }).pipe(
        Stream.toPull,
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
      );
      expect(independent.directory.files).toMatchObject([{ name: "interview.txt", kind: "text" }]);
      expect(independent.directory.files[0]!.id).not.toBe(reopened.directory.files[0]!.id);
      expect(
        yield* client["workspaces.readDirectory"]({
          directorySessionId: reopened.directory.directorySessionId,
          offset: 0,
        }),
      ).toEqual(reopened.directory);
      expect(
        yield* otherRenderer["workspaces.readDirectory"]({
          directorySessionId: reopened.directory.directorySessionId,
          offset: 0,
        }).pipe(Effect.flip),
      ).toMatchObject({ code: "DirectorySessionExpired" });
      expect(
        yield* host["workspaces.reconnect"]({ id: child.id, path: copyPath }).pipe(Effect.flip),
      ).toMatchObject({ code: "RootConflict" });
      expect(
        yield* host["workspaces.reconnect"]({ id: child.id, path: archive }).pipe(Effect.flip),
      ).toMatchObject({ code: "WorkspaceChanged" });
      expect(yield* (yield* Workspaces).get(child.id)).toEqual(child);
      const moved = join(root, "Moved");
      yield* Effect.promise(() => rename(film, moved));
      expect(yield* (yield* Workspaces).get(child.id).pipe(Effect.flip)).toMatchObject({
        code: "FolderUnavailable",
      });
      yield* Effect.promise(() => mkdir(film));
      expect(
        yield* client["workspaces.browse"]({ id: child.id }).pipe(Stream.runDrain, Effect.flip),
      ).toMatchObject({
        code: "InvalidWorkspace",
      });
      expect(yield* Effect.promise(() => readdir(film))).toEqual([]);
      const reconnected = yield* host["workspaces.reconnect"]({
        id: child.id,
        path: moved,
      });
      expect(reconnected.id).toBe(child.id);
      expect(reconnected.root).toBe(moved);
      const movedView = yield* client["workspaces.browse"]({ id: child.id }).pipe(
        Stream.toPull,
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
      );
      expect(movedView.directory.files[0]!.id).toBe(reopened.directory.files[0]!.id);
      yield* client["workspaces.forget"]({ id: parent.id });
      const remembered = yield* host["workspaces.open"]({ path: archive });
      expect(remembered.root).toBe(parent.root);
      expect(remembered.id).not.toBe(parent.id);
      return reconnected;
    }),
  );
  expect(await readdir(join(profile, "temporary"))).toEqual([]);
  await run(
    Effect.gen(function* () {
      const workspaces = yield* Workspaces;
      expect(yield* workspaces.get(saved.id)).toEqual(saved);
    }),
  );
  const manifest = await readFile(join(saved.root, ".stargeist", "workspace.json"), "utf8");
  await rm(join(profile, "data"), { recursive: true });
  await run(
    Effect.gen(function* () {
      const workspaces = yield* Workspaces;
      expect(yield* workspaces.list).toEqual([]);
      const reopened = yield* workspaces.open(saved.root);
      expect(reopened.root).toBe(saved.root);
      expect(reopened.id).not.toBe(saved.id);
    }),
  );
  expect(await readFile(join(saved.root, ".stargeist", "workspace.json"), "utf8")).toBe(manifest);
  expect(await readFile(join(saved.root, "interview.txt"), "utf8")).toBe("original");
}, 15000);

it("rejects identity replacement at a remembered root until that folder is explicitly reopened", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "stargeist-replacement-")));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const original = join(root, "original");
  const replacement = join(root, "replacement");
  await mkdir(original);
  await mkdir(replacement);
  await Effect.runPromise(
    Effect.gen(function* () {
      const workspaces = yield* Workspaces;
      const first = yield* workspaces.open(original);
      const other = yield* workspaces.open(replacement);
      yield* Effect.promise(() =>
        cp(
          join(replacement, ".stargeist", "workspace.json"),
          join(original, ".stargeist", "workspace.json"),
        ),
      );
      expect(yield* workspaces.get(first.id).pipe(Effect.flip)).toMatchObject({
        code: "WorkspaceChanged",
      });
      const reopened = yield* workspaces.open(original);
      expect(reopened.id).not.toBe(other.id);
      expect(reopened.root).toBe(original);
      expect(reopened.id).not.toBe(first.id);
      expect(yield* workspaces.get(first.id).pipe(Effect.flip)).toMatchObject({
        code: "NotFound",
      });
    }).pipe(
      Effect.provide(BackendApplication.layer),
      Effect.provide(AppStorage.layer(join(root, "profile"))),
    ),
  );
});

it("releases a directory when browsing is canceled before its response arrives", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "stargeist-cancel-")));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const folder = join(root, "workspace");
  const profile = join(root, "profile");
  await mkdir(folder);
  await Effect.runPromise(
    Effect.gen(function* () {
      const workspace = yield* (yield* Workspaces).open(folder);
      const { directory } = yield* TemporaryStorage;
      const responseReady = yield* Deferred.make<void>();
      const handlers = yield* Layer.build(WorkspaceEndpoint.layer);
      const server = yield* RpcServer.makeNoSerialization(WorkspaceEndpoint.rpcs, {
        onFromServer: () => Deferred.succeed(responseReady, undefined).pipe(Effect.asVoid),
      }).pipe(Effect.provide(handlers));
      const client = yield* RpcClient.makeNoSerialization(WorkspaceEndpoint.rpcs, {
        supportsAck: true,
        onFromClient: ({ message }) => server.write(0, message),
      });
      const pending = yield* client.client["workspaces.browse"]({ id: workspace.id }).pipe(
        Stream.runDrain,
        Effect.forkScoped,
      );
      yield* Deferred.await(responseReady);
      expect(yield* Effect.promise(() => readdir(directory))).not.toEqual([]);
      yield* Fiber.interrupt(pending);
      yield* Effect.promise(() =>
        expect.poll(() => readdir(directory), { timeout: 1000 }).toEqual([]),
      );
    }).pipe(
      Effect.scoped,
      Effect.provide(BackendApplication.layer),
      Effect.provide(temporaryStorageLayer.pipe(Layer.provideMerge(AppStorage.layer(profile)))),
      Effect.timeout("5 seconds"),
    ),
  );
});
