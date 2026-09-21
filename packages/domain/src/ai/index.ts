import { Context, type Effect, Schema } from "effect";

export const ProviderId = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]{0,63}$/));

export const ProviderCredential = Schema.Struct({
  kind: Schema.Literal("apiKey"),
  key: Schema.Redacted(Schema.String),
});
export type ProviderCredential = typeof ProviderCredential.Type;

export const ConfigureProvider = Schema.Struct({
  providerId: ProviderId,
  credential: ProviderCredential,
}).annotate({ message: "Invalid provider configuration." });
export type ConfigureProvider = typeof ConfigureProvider.Type;

export class ProviderConnectionError extends Schema.TaggedError<ProviderConnectionError>()(
  "ProviderConnectionError",
  {
    code: Schema.Literals([
      "UnknownProvider",
      "InvalidCredential",
      "UnsupportedCredential",
      "NotConfigured",
      "Busy",
      "NetworkUnavailable",
      "RateLimited",
      "ProviderUnavailable",
      "InvalidResponse",
      "SecureStorageUnavailable",
      "CredentialUnreadable",
      "StorageUnavailable",
    ]),
    message: Schema.String,
  },
) {}

export const ConnectionState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("notConfigured") }),
  Schema.Struct({
    status: Schema.Literal("configured"),
    keyHint: Schema.String,
    lastValidatedAt: Schema.Number,
  }),
  Schema.Struct({ status: Schema.Literal("unavailable"), error: ProviderConnectionError }),
]);
export type ConnectionState = typeof ConnectionState.Type;

export const ProviderConnection = Schema.Struct({
  providerId: ProviderId,
  displayName: Schema.NonEmptyString,
  credentialKind: Schema.Literal("apiKey"),
  state: ConnectionState,
});
export type ProviderConnection = typeof ProviderConnection.Type;

export class AIProviderConnections extends Context.Service<
  AIProviderConnections,
  {
    readonly list: Effect.Effect<ReadonlyArray<ProviderConnection>>;
    readonly configure: (
      input: ConfigureProvider,
    ) => Effect.Effect<ProviderConnection, ProviderConnectionError>;
    readonly check: (
      providerId: string,
    ) => Effect.Effect<ProviderConnection, ProviderConnectionError>;
    readonly remove: (providerId: string) => Effect.Effect<void, ProviderConnectionError>;
  }
>()("@stargeist/domain/AIProviderConnections") {}
