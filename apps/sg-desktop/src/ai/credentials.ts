import { ProviderCredential, ProviderId, type ProviderConnectionError } from "@stargeist/domain";
import { Context, type Effect, Schema } from "effect";

export const StoredCredential = Schema.Struct({
  version: Schema.Literal(1),
  providerId: ProviderId,
  credential: ProviderCredential,
  lastValidatedAt: Schema.Number,
});
export type StoredCredential = typeof StoredCredential.Type;

export class Credentials extends Context.Service<
  Credentials,
  {
    readonly read: (
      providerId: string,
    ) => Effect.Effect<StoredCredential | null, ProviderConnectionError>;
    readonly write: (record: StoredCredential) => Effect.Effect<void, ProviderConnectionError>;
    readonly remove: (providerId: string) => Effect.Effect<void, ProviderConnectionError>;
  }
>()("@stargeist/desktop/ai/Credentials") {}
