import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import {
  createAIProviderConnectionsState,
  type AIProviderConnectionsState as State,
} from "./state";
import { makeRpcAIProviderConnectionsClient } from "./rpc";

export class AIProviderConnectionsState extends Context.Service<
  AIProviderConnectionsState,
  State
>()("@stargeist/renderer/AIProviderConnectionsState") {}

export const AIProviderConnectionsStateModule = Module.define({
  exports: AIProviderConnectionsState,
  layer: Layer.effect(
    AIProviderConnectionsState,
    Effect.flatMap(DesktopConnection, makeRpcAIProviderConnectionsClient).pipe(
      Effect.map(createAIProviderConnectionsState),
    ),
  ),
});
