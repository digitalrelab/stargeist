import { Module } from "@stargeist/application";
import { Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { WorkspacesClient } from "./client";
import { makeRpcWorkspacesClient } from "./rpc";

export const WorkspacesModule = Module.define({
  exports: WorkspacesClient,
  layer: Layer.effect(WorkspacesClient, Effect.flatMap(DesktopConnection, makeRpcWorkspacesClient)),
});
