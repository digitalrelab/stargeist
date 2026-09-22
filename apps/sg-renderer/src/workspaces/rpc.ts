import { connectionFailure } from "#src/desktop/errors.ts";
import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/protocol/workspaces";
import { Effect } from "effect";
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
      backend["workspaces.browse"]({ id }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    readDirectory: (input) =>
      backend["workspaces.readDirectory"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    closeDirectory: (input) =>
      backend["workspaces.closeDirectory"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
  };
  return client;
});
