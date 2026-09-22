import { Module } from "@stargeist/application";
import { Context, Effect, Layer } from "effect";
import { DesktopConnection } from "#src/desktop/index.ts";
import { createAIState, type AIState as State } from "./state";
import { makeRpcAgentModelsClient, makeRpcAIProviderConnectionsClient } from "./rpc";

export class AIState extends Context.Service<AIState, State>()("@stargeist/renderer/AIState") {}

export const AIStateModule = Module.define({
  exports: AIState,
  layer: Layer.effect(
    AIState,
    Effect.gen(function* () {
      const connection = yield* DesktopConnection;
      const connections = yield* makeRpcAIProviderConnectionsClient(connection);
      const models = yield* makeRpcAgentModelsClient(connection);
      return createAIState(connections, models);
    }),
  ),
});
