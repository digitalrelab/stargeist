import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { createWorkspaceState, type WorkspaceState } from "./state";
import { makeRpcWorkspacesClient } from "./rpc";

export class Workspaces extends Context.Service<Workspaces, WorkspaceState>()(
  "@stargeist/renderer/Workspaces",
) {}

export const WorkspacesModule = Module.define({
  exports: Workspaces,
  layer: Layer.effect(
    Workspaces,
    Effect.flatMap(DesktopConnection, makeRpcWorkspacesClient).pipe(
      Effect.map(createWorkspaceState),
    ),
  ),
});
