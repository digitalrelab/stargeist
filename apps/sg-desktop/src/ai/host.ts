import * as RpcEndpoint from "@stargeist/application/rpc";
import { ProviderConnections } from "@stargeist/ai";
import { AgentModelCatalog, AgentModelPreferences } from "@stargeist/domain/ai";
import { AgentModelRpcs, ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { Effect } from "effect";
import { Rpc } from "effect/unstable/rpc";

export const ProviderConnectionsEndpoint = RpcEndpoint.define(ProviderConnectionRpcs)({
  concurrency: 1,
  implementation: Effect.gen(function* () {
    const connections = yield* ProviderConnections;
    return {
      "ai.connections.list": () => Rpc.fork(connections.list),
      "ai.connections.configure": (input) => Rpc.fork(connections.configure(input)),
      "ai.connections.check": ({ providerId }) => Rpc.fork(connections.check(providerId)),
      "ai.connections.remove": ({ providerId }) => Rpc.fork(connections.remove(providerId)),
    };
  }),
});

export const AgentModelsEndpoint = RpcEndpoint.define(AgentModelRpcs)({
  concurrency: 1,
  implementation: Effect.gen(function* () {
    const catalog = yield* AgentModelCatalog;
    const preferences = yield* AgentModelPreferences;
    return {
      "ai.models.list": () => Rpc.fork(catalog.list),
      "ai.models.getDefault": () => Rpc.fork(preferences.getDefault),
      "ai.models.setDefault": ({ model }) => Rpc.fork(preferences.setDefault(model)),
    };
  }),
});
