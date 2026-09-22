import type {
  ModelReference,
  ConfigureProvider,
  ProviderConnection,
  ProviderConnectionError,
  ProviderModelCatalog,
} from "@stargeist/ai";
import type { AgentModelPreferenceError } from "@stargeist/domain/ai";
import type { Effect } from "effect";
import type { ClientUnavailableError } from "#src/client/index.ts";

type ConnectionError = ProviderConnectionError | ClientUnavailableError;
type AgentModelsError = AgentModelPreferenceError | ClientUnavailableError;

export interface AIProviderConnectionsClient {
  readonly list: Effect.Effect<ReadonlyArray<ProviderConnection>, ConnectionError>;
  readonly configure: (
    input: ConfigureProvider,
  ) => Effect.Effect<ProviderConnection, ConnectionError>;
  readonly check: (providerId: string) => Effect.Effect<ProviderConnection, ConnectionError>;
  readonly remove: (providerId: string) => Effect.Effect<void, ConnectionError>;
}

export interface AgentModelsClient {
  readonly list: Effect.Effect<ReadonlyArray<ProviderModelCatalog>, ClientUnavailableError>;
  readonly getDefault: Effect.Effect<ModelReference | null, AgentModelsError>;
  readonly setDefault: (model: ModelReference) => Effect.Effect<void, AgentModelsError>;
}
