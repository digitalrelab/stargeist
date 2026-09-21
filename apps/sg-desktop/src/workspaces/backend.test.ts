import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { expect, it, onTestFinished } from "vite-plus/test";
import { BackendApplication } from "../backend/application";
import { directoriesLayer } from "../storage";
import { backendHandlers } from "../backend/server";
import { ControlRpcs, RendererRpcs } from "../backend/rpc";

it("creates a workspace and first library from a folder and browses the selected library through the real backend", async () => {
  const root = await mkdtemp(join(tmpdir(), "stargeist-libraries-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const interviews = join(root, "Interviews");
  const archive = join(root, "Archive");
  await mkdir(interviews);
  await mkdir(archive);
  await writeFile(join(interviews, "interview.txt"), "original");
  await writeFile(join(archive, "archive.txt"), "archive");

  await Effect.runPromise(
    Effect.gen(function* () {
      const application = yield* BackendApplication.make;
      const layers = backendHandlers(application);
      const handlers = yield* Layer.build(Layer.merge(layers.control, layers.renderer));

      const client = yield* RpcTest.makeClient(RendererRpcs).pipe(Effect.provide(handlers));

      const host = yield* RpcTest.makeClient(ControlRpcs).pipe(Effect.provide(handlers));

      expect(
        yield* host["workspaces.create"]({ path: join(root, "missing") }).pipe(Effect.flip),
      ).toMatchObject({ code: "FolderUnavailable" });
      expect(yield* client["workspaces.list"]()).toEqual([]);

      const { workspace, library: first } = yield* host["workspaces.create"]({
        path: interviews,
      });
      expect(workspace.displayName).toBe("Interviews");
      expect(first.displayName).toBe("Interviews");
      const second = yield* host["libraries.add"]({ workspaceId: workspace.id, path: archive });

      expect(second.displayName).toBe("Archive");
      expect(yield* client["libraries.list"]({ workspaceId: workspace.id })).toEqual([
        first,
        second,
      ]);
      const opened = yield* client["libraries.openDirectory"]({
        workspaceId: workspace.id,
        id: first.id,
      });
      expect(opened.entries.map((entry) => entry.name)).toEqual(["interview.txt"]);
      const next = yield* client["libraries.openDirectory"]({
        workspaceId: workspace.id,
        id: second.id,
      });
      expect(next.entries.map((entry) => entry.name)).toEqual(["archive.txt"]);
      expect(
        yield* client["libraries.readDirectory"]({ listingId: opened.listingId, offset: 0 }).pipe(
          Effect.flip,
        ),
      ).toMatchObject({ code: "ListingExpired" });
      const { workspace: other } = yield* host["workspaces.create"]({ path: archive });
      expect(
        yield* client["libraries.openDirectory"]({ workspaceId: other.id, id: first.id }).pipe(
          Effect.flip,
        ),
      ).toMatchObject({ code: "NotFound" });
      const reference = yield* host["libraries.add"]({ workspaceId: other.id, path: interviews });
      expect(reference.id).not.toBe(first.id);
      expect(reference.source).toEqual(first.source);
      expect(
        yield* host["libraries.add"]({
          workspaceId: workspace.id,
          path: join(root, "missing"),
        }).pipe(Effect.flip),
      ).toMatchObject({ code: "FolderUnavailable" });
      expect(yield* client["libraries.list"]({ workspaceId: workspace.id })).toEqual([
        first,
        second,
      ]);
    }).pipe(Effect.scoped, Effect.provide(directoriesLayer(join(root, "profile")))),
  );
  expect(await readFile(join(interviews, "interview.txt"), "utf8")).toBe("original");
});
