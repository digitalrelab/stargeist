import { AIProviderConnections } from "@stargeist/domain/ai";
import { ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { Effect } from "effect";
import { Rpc } from "effect/unstable/rpc";

export const providerConnectionHandlers = ProviderConnectionRpcs.toLayer(
  Effect.gen(function* () {
    const connections = yield* AIProviderConnections;
    return {
      "ai.connections.list": () => Rpc.fork(connections.list),
      "ai.connections.configure": (input) => Rpc.fork(connections.configure(input)),
      "ai.connections.check": ({ providerId }) => Rpc.fork(connections.check(providerId)),
      "ai.connections.remove": ({ providerId }) => Rpc.fork(connections.remove(providerId)),
    };
  }),
);
