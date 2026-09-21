import type { LibraryRpcs, LibraryDialogRpcs } from "@stargeist/domain/libraries/rpc";
import { Context } from "effect";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";

type ReadClient = RpcClient.FromGroup<typeof LibraryRpcs, RpcClientError.RpcClientError>;

type DialogClient = RpcClient.FromGroup<typeof LibraryDialogRpcs, RpcClientError.RpcClientError>;

export class LibrariesClient extends Context.Service<
  LibrariesClient,
  {
    readonly list: ReadClient["libraries.list"];
    readonly get: ReadClient["libraries.get"];
    readonly add: DialogClient["libraries.add"];
    readonly openDirectory: ReadClient["libraries.openDirectory"];
    readonly readDirectory: ReadClient["libraries.readDirectory"];
    readonly closeDirectory: ReadClient["libraries.closeDirectory"];
  }
>()("@stargeist/renderer/LibrariesClient") {}
