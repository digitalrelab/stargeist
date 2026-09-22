import type { ModelReference, ProviderConfiguration } from "@stargeist/ai";
import { Effect, Redacted } from "effect";
import { Atom } from "effect/unstable/reactivity";
import type { AgentModelsClient, AIProviderConnectionsClient } from "./client";

export type ConnectionAction =
  | { readonly type: "configure"; readonly configuration: ProviderConfiguration }
  | { readonly type: "remove" };

export const createAIState = (
  connectionsClient: AIProviderConnectionsClient,
  agentModelsClient: AgentModelsClient,
) => {
  const connections = Atom.make(connectionsClient.list).pipe(Atom.keepAlive);
  const catalogs = Atom.make(agentModelsClient.list).pipe(
    Atom.keepAlive,
    Atom.swr({ staleTime: "5 minutes" }),
    Atom.withRefresh("5 minutes"),
  );
  const defaultModel = Atom.make(agentModelsClient.getDefault).pipe(Atom.keepAlive);
  const healthCheck = Atom.family((providerId: string) =>
    Atom.fn((_arg: void) => connectionsClient.check(providerId)),
  );
  const providerOperation = Atom.family((providerId: string) =>
    Atom.fn((action: ConnectionAction, get) =>
      Effect.gen(function* () {
        get.set(healthCheck(providerId), Atom.Reset);
        switch (action.type) {
          case "configure":
            yield* connectionsClient
              .configure({ providerId, configuration: action.configuration })
              .pipe(Effect.ensuring(Effect.sync(() => Redacted.wipeUnsafe(action.configuration))));
            break;
          case "remove":
            yield* connectionsClient.remove(providerId);
            break;
        }
        get.refresh(connections);
        get.refresh(catalogs);
        return action.type;
      }),
    ),
  );
  const updateDefaultModel = Atom.fn((model: ModelReference, get) =>
    Effect.gen(function* () {
      yield* agentModelsClient.setDefault(model);
      get.refresh(defaultModel);
      return model;
    }),
  );
  return {
    providerConnections: {
      list: connections,
      healthCheck,
      operation: providerOperation,
    },
    agentModels: {
      catalogs,
      defaultModel,
      updateDefaultModel,
    },
  };
};

export type AIState = ReturnType<typeof createAIState>;
export type ProviderConnectionOperation = ReturnType<AIState["providerConnections"]["operation"]>;
export type ProviderHealthCheck = ReturnType<AIState["providerConnections"]["healthCheck"]>;
