import { connectionFailure } from "#src/desktop/errors.ts";
import { LibraryRpcs, LibraryDialogRpcs } from "@stargeist/protocol/libraries";
import { Effect } from "effect";
import { RpcClient } from "effect/unstable/rpc";
import type { LibrariesClient } from "./client";

export const makeRpcLibrariesClient = Effect.fnUntraced(function* (protocols: {
  readonly backend: RpcClient.Protocol["Service"];
  readonly host: RpcClient.Protocol["Service"];
}) {
  const backend = yield* RpcClient.make(LibraryRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.backend),
  );

  const host = yield* RpcClient.make(LibraryDialogRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.host),
  );

  const client: LibrariesClient = {
    list: (workspaceId) =>
      backend["libraries.list"]({ workspaceId }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    get: (selection) =>
      backend["libraries.get"](selection).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    addFromFolder: (workspaceId) =>
      host["libraries.addFromFolder"]({ workspaceId }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    openDirectory: (selection) =>
      backend["libraries.openDirectory"](selection).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    readDirectory: (input) =>
      backend["libraries.readDirectory"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    closeDirectory: (input) =>
      backend["libraries.closeDirectory"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
  };
  return client;
});
