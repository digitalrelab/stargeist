import type { ProviderCredential } from "@stargeist/domain/ai";
import { Effect, Redacted } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { AIProviderConnectionsClient } from "./client";

export type ConnectionAction =
  | { readonly type: "configure"; readonly credential: ProviderCredential }
  | { readonly type: "check" }
  | { readonly type: "remove" };

export const createAIProviderConnectionsState = (client: AIProviderConnectionsClient) => {
  const connections = Atom.make(client.list);
  const operation = Atom.family((providerId: string) =>
    Atom.fn((action: ConnectionAction, get) =>
      Effect.gen(function* () {
        switch (action.type) {
          case "configure":
            yield* client
              .configure({ providerId, credential: action.credential })
              .pipe(Effect.ensuring(Effect.sync(() => Redacted.wipeUnsafe(action.credential.key))));
            break;
          case "check":
            yield* client.check(providerId);
            break;
          case "remove":
            yield* client.remove(providerId);
            break;
        }
        get.refresh(connections);
        return action.type;
      }),
    ),
  );
  return { connections, operation };
};

export type AIProviderConnectionsState = ReturnType<typeof createAIProviderConnectionsState>;
