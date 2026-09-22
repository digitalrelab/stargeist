import { Workspace, WorkspaceError, WorkspaceId, type Workspaces } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Cause, Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup, RpcClient, type RpcClientError } from "effect/unstable/rpc";

export const WorkspaceControlRpcs = RpcGroup.make(
  Rpc.make("open", {
    payload: { path: Schema.String },
    success: Workspace,
    error: WorkspaceError,
  }),
  Rpc.make("initialize", {
    payload: { path: Schema.String },
    success: Workspace,
    error: WorkspaceError,
  }),
  Rpc.make("reconnect", {
    payload: { id: WorkspaceId, path: Schema.String },
    success: Workspace,
    error: WorkspaceError,
  }),
).prefix("workspaces.");

export class WorkspaceCommands extends Context.Service<
  WorkspaceCommands,
  Pick<Workspaces["Service"], "open" | "initialize" | "reconnect">
>()("@stargeist/desktop/WorkspaceCommands") {}

export const workspaceCommandsLayer = Layer.effect(
  WorkspaceCommands,
  Effect.gen(function* () {
    const client = yield* RpcClient.make(WorkspaceControlRpcs);
    const unavailable = (error: RpcClientError.RpcClientError) =>
      reportFailure("workspaces.backend", Cause.fail(error)).pipe(
        Effect.andThen(
          Effect.fail(
            new WorkspaceError({
              code: "BackendUnavailable",
              message: "The backend connection is unavailable. Reopen Stargeist to reconnect.",
            }),
          ),
        ),
      );
    return WorkspaceCommands.of({
      open: (path) =>
        client["workspaces.open"]({ path }).pipe(Effect.catchTag("RpcClientError", unavailable)),
      initialize: (path) =>
        client["workspaces.initialize"]({ path }).pipe(
          Effect.catchTag("RpcClientError", unavailable),
        ),
      reconnect: (id, path) =>
        client["workspaces.reconnect"]({ id, path }).pipe(
          Effect.catchTag("RpcClientError", unavailable),
        ),
    });
  }),
);
