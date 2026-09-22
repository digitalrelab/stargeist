import { ClientUnavailableError } from "#src/client/index.ts";
import { connectionFailure } from "#src/desktop/errors.ts";
import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/protocol/workspaces";
import { Effect, Pull, Stream } from "effect";
import { RpcClient } from "effect/unstable/rpc";
import type { WorkspacesClient } from "./client";

export const makeRpcWorkspacesClient = Effect.fnUntraced(function* (protocols: {
  readonly backend: RpcClient.Protocol["Service"];
  readonly host: RpcClient.Protocol["Service"];
}) {
  const backend = yield* RpcClient.make(WorkspaceRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.backend),
  );
  const host = yield* RpcClient.make(WorkspaceDialogRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.host),
  );
  const client: WorkspacesClient = {
    list: Effect.suspend(() => backend["workspaces.list"]()).pipe(
      Effect.catchTag("RpcClientError", connectionFailure),
    ),
    openFromFolder: () =>
      host["workspaces.openFromFolder"]().pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    initializeFromFolder: () =>
      host["workspaces.initializeFromFolder"]().pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    reconnectFromFolder: (id) =>
      host["workspaces.reconnectFromFolder"]({ id }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    forget: (id) =>
      backend["workspaces.forget"]({ id }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    browse: (id) =>
      Stream.toPull(backend["workspaces.browse"]({ id })).pipe(
        Effect.flatMap((pull) => pull),
        Effect.map((views) => views[0]),
        Pull.catchDone(() =>
          Effect.fail(
            new ClientUnavailableError({
              message: "The workspace connection closed before opening the folder.",
            }),
          ),
        ),
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    readDirectory: (input) =>
      backend["workspaces.readDirectory"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
  };
  return client;
});
