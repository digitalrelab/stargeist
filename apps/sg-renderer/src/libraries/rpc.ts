import { LibraryRpcs, LibraryDialogRpcs } from "@stargeist/domain/libraries/rpc";
import { Effect } from "effect";
import { RpcClient } from "effect/unstable/rpc";
import type { LibrariesClient } from "./client";

export const makeRpcLibrariesClient = (protocols: {
  readonly backend: RpcClient.Protocol["Service"];
  readonly host: RpcClient.Protocol["Service"];
}) =>
  Effect.gen(function* () {
    const backend = yield* RpcClient.make(LibraryRpcs).pipe(
      Effect.provideService(RpcClient.Protocol, protocols.backend),
    );

    const host = yield* RpcClient.make(LibraryDialogRpcs).pipe(
      Effect.provideService(RpcClient.Protocol, protocols.host),
    );

    return {
      list: backend["libraries.list"],
      get: backend["libraries.get"],
      add: host["libraries.add"],
      openDirectory: backend["libraries.openDirectory"],
      readDirectory: backend["libraries.readDirectory"],
      closeDirectory: backend["libraries.closeDirectory"],
    } satisfies LibrariesClient["Service"];
  });
