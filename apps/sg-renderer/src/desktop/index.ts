import { Context } from "effect";
import type { RpcClient } from "effect/unstable/rpc";

export class DesktopConnection extends Context.Service<
  DesktopConnection,
  {
    readonly backend: RpcClient.Protocol["Service"];
    readonly host: RpcClient.Protocol["Service"];
  }
>()("@stargeist/renderer/DesktopConnection") {}
