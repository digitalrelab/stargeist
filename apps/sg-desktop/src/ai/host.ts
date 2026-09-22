import * as RpcEndpoint from "@stargeist/application/rpc";
import { AIProviderConnections } from "@stargeist/domain";
import { ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { Effect } from "effect";
import { Rpc } from "effect/unstable/rpc";

export const ProviderConnectionsEndpoint = RpcEndpoint.define(ProviderConnectionRpcs)({
  concurrency: 1,
  implementation: Effect.gen(function* () {
    const connections = yield* AIProviderConnections;
    return {
      "ai.connections.list": () => Rpc.fork(connections.list),
      "ai.connections.configure": (input) => Rpc.fork(connections.configure(input)),
      "ai.connections.check": ({ providerId }) => Rpc.fork(connections.check(providerId)),
      "ai.connections.remove": ({ providerId }) => Rpc.fork(connections.remove(providerId)),
    };
  }),
});
