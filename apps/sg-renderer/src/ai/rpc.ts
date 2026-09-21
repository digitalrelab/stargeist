import { ProviderConnectionRpcs } from "@stargeist/protocol/ai";
import { Effect } from "effect";
import { RpcClient } from "effect/unstable/rpc";
import { connectionFailure } from "#src/desktop/errors.ts";
import type { AIProviderConnectionsClient } from "./client";

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
