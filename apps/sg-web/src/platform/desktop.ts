import { Effect, Layer } from "effect";
import { DesktopConnection, desktopConnectionLayer } from "#src/desktop/index.ts";
import { WorkspacesClient, makeRpcWorkspacesClient } from "#src/workspaces/rpc.ts";

export const workspacesLayer = Layer.effect(
  WorkspacesClient,
  Effect.flatMap(DesktopConnection, makeRpcWorkspacesClient),
).pipe(Layer.provide(desktopConnectionLayer));
