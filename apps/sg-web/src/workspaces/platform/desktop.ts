import { Effect, Layer } from "effect";
import { DesktopConnection, desktopConnectionLayer } from "#src/desktop/index.ts";
import { WorkspacesClient } from "../client";
import { makeRpcWorkspacesClient } from "../rpc";

export const workspacesLayer = Layer.effect(
  WorkspacesClient,
  Effect.flatMap(DesktopConnection, makeRpcWorkspacesClient),
).pipe(Layer.provide(desktopConnectionLayer));
