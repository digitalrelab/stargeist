import type { ProviderCredential } from "@stargeist/domain";
import { Effect, Redacted } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { AIProviderConnectionsClient } from "./client";

export type ConnectionAction =
  | { readonly type: "configure"; readonly credential: ProviderCredential }
  | { readonly type: "remove" };

export const createAIProviderConnectionsState = (client: AIProviderConnectionsClient) => {
  const connections = Atom.make(client.list);
  const health = Atom.family((providerId: string) =>
    Atom.fn((_arg: void) => client.check(providerId)),
  );
  const operation = Atom.family((providerId: string) =>
    Atom.fn((action: ConnectionAction, get) =>
      Effect.gen(function* () {
        get.set(health(providerId), Atom.Reset);
        switch (action.type) {
          case "configure":
            yield* client
              .configure({ providerId, credential: action.credential })
              .pipe(Effect.ensuring(Effect.sync(() => Redacted.wipeUnsafe(action.credential.key))));
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
  return { connections, health, operation };
};

export type AIProviderConnectionsState = ReturnType<typeof createAIProviderConnectionsState>;
