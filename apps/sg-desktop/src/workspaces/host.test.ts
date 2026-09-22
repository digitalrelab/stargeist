import { Workspace, WorkspaceError, WorkspaceId } from "@stargeist/domain";
import { Effect, Layer, Schema } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { expect, it } from "vite-plus/test";
import { FolderPicker, FolderPickerError } from "../filesystem/dialogs";
import { WorkspaceCommands, WorkspaceDialogsEndpoint } from "./host";

const workspace = new Workspace({
  id: Schema.decodeUnknownSync(WorkspaceId)("wsp_00000000000000000000000001"),
  root: "/archive",
});

it("binds each dialog session to its picker and dispatches only confirmed choices", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const calls: string[] = [];
      const commands = Layer.succeed(WorkspaceCommands, {
        open: (path) =>
          Effect.sync(() => {
            calls.push(`open:${path}`);
            return workspace;
          }),
        initialize: (path) =>
          Effect.sync(() => {
            calls.push(`initialize:${path}`);
            return workspace;
          }),
        reconnect: (id, path) =>
          Effect.sync(() => {
            calls.push(`reconnect:${id}:${path}`);
            return workspace;
          }),
      });
      const clientFor = Effect.fnUntraced(function* (path: string | null) {
        const context = yield* Layer.build(
          WorkspaceDialogsEndpoint.layer.pipe(
            Layer.provide(
              Layer.merge(
                commands,
                Layer.succeed(FolderPicker, { choose: () => Effect.succeed(path) }),
              ),
            ),
          ),
        );
        return yield* RpcTest.makeClient(WorkspaceDialogsEndpoint.rpcs).pipe(
          Effect.provide(context),
        );
      });
      const canceled = yield* clientFor(null);
      expect(yield* canceled["workspaces.openFromFolder"]()).toBeNull();
      expect(yield* canceled["workspaces.initializeFromFolder"]()).toBeNull();
      expect(yield* canceled["workspaces.reconnectFromFolder"]({ id: workspace.id })).toBeNull();
      expect(calls).toEqual([]);
      const first = yield* clientFor("/first");
      const second = yield* clientFor("/second");
      expect(yield* first["workspaces.openFromFolder"]()).toEqual(workspace);
      yield* second["workspaces.initializeFromFolder"]();
      yield* first["workspaces.reconnectFromFolder"]({ id: workspace.id });
      expect(calls).toEqual([
        "open:/first",
        "initialize:/second",
        `reconnect:${workspace.id}:/first`,
      ]);
    }).pipe(Effect.scoped),
  );
});

it("distinguishes picker failure from workspace operation failure", async () => {
  const failure = new WorkspaceError({
    code: "InvalidWorkspace",
    message: "Workspace metadata is invalid.",
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      let choose: FolderPicker["Service"]["choose"] = () =>
        Effect.fail(new FolderPickerError({ cause: new Error("Native dialog failed") }));
      const context = yield* Layer.build(
        WorkspaceDialogsEndpoint.layer.pipe(
          Layer.provide(
            Layer.merge(
              Layer.succeed(FolderPicker, { choose: (title) => choose(title) }),
              Layer.succeed(WorkspaceCommands, {
                open: () => Effect.fail(failure),
                initialize: () => Effect.fail(failure),
                reconnect: () => Effect.fail(failure),
              }),
            ),
          ),
        ),
      );
      const client = yield* RpcTest.makeClient(WorkspaceDialogsEndpoint.rpcs).pipe(
        Effect.provide(context),
      );
      expect(yield* client["workspaces.openFromFolder"]().pipe(Effect.flip)).toMatchObject({
        code: "FolderPickerUnavailable",
      });
      choose = () => Effect.succeed("/archive");
      expect(yield* client["workspaces.openFromFolder"]().pipe(Effect.flip)).toEqual(failure);
    }).pipe(Effect.scoped),
  );
});
