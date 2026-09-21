import { WorkspaceRpcs, WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
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

  return {
    list: backend["workspaces.list"],
    get: backend["workspaces.get"],
    create: host["workspaces.create"],
  } satisfies WorkspacesClient;
});
