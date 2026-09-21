import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { createWorkspaceState, type WorkspaceState as State } from "./state";
import { makeRpcWorkspacesClient } from "./rpc";

export class WorkspaceState extends Context.Service<WorkspaceState, State>()(
  "@stargeist/renderer/WorkspaceState",
) {}

export const WorkspaceStateModule = Module.define({
  exports: WorkspaceState,
  layer: Layer.effect(
    WorkspaceState,
    Effect.flatMap(DesktopConnection, makeRpcWorkspacesClient).pipe(
      Effect.map(createWorkspaceState),
    ),
  ),
});
