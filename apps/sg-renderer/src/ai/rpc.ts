import { AgentModelRpcs, ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { Effect } from "effect";
import { RpcClient } from "effect/unstable/rpc";
import { connectionFailure } from "#src/desktop/errors.ts";
import type { AgentModelsClient, AIProviderConnectionsClient } from "./client";

export const makeRpcAIProviderConnectionsClient = Effect.fnUntraced(function* (protocols: {
  readonly host: RpcClient.Protocol["Service"];
}) {
  const host = yield* RpcClient.make(ProviderConnectionRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.host),
  );
  return {
    list: Effect.suspend(() => host["ai.connections.list"]()).pipe(
      Effect.catchTag("RpcClientError", connectionFailure),
    ),
    configure: (input) =>
      host["ai.connections.configure"](input).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    check: (providerId) =>
      host["ai.connections.check"]({ providerId }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
    remove: (providerId) =>
      host["ai.connections.remove"]({ providerId }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
  } satisfies AIProviderConnectionsClient;
});

export const makeRpcAgentModelsClient = Effect.fnUntraced(function* (protocols: {
  readonly host: RpcClient.Protocol["Service"];
}) {
  const host = yield* RpcClient.make(AgentModelRpcs).pipe(
    Effect.provideService(RpcClient.Protocol, protocols.host),
  );
  return {
    list: Effect.suspend(() => host["ai.models.list"]()).pipe(
      Effect.catchTag("RpcClientError", connectionFailure),
    ),
    getDefault: Effect.suspend(() => host["ai.models.getDefault"]()).pipe(
      Effect.catchTag("RpcClientError", connectionFailure),
    ),
    setDefault: (model) =>
      host["ai.models.setDefault"]({ model }).pipe(
        Effect.catchTag("RpcClientError", connectionFailure),
      ),
  } satisfies AgentModelsClient;
});
