import type {
  ConfigureProvider,
  ProviderConnection,
  ProviderConnectionError,
} from "@stargeist/domain";
import type { Effect } from "effect";
import type { ClientUnavailableError } from "#src/client/index.ts";

type ConnectionError = ProviderConnectionError | ClientUnavailableError;

export interface AIProviderConnectionsClient {
  readonly list: Effect.Effect<ReadonlyArray<ProviderConnection>, ConnectionError>;
  readonly configure: (
    input: ConfigureProvider,
  ) => Effect.Effect<ProviderConnection, ConnectionError>;
  readonly check: (providerId: string) => Effect.Effect<ProviderConnection, ConnectionError>;
  readonly remove: (providerId: string) => Effect.Effect<void, ConnectionError>;
}
