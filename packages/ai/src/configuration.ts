import { Context, type Effect, Schema } from "effect";
import { ProviderId } from "./models";
import type { ProviderConnectionError } from "./errors";

export const ProviderConfiguration = Schema.Redacted(Schema.Json);
export type ProviderConfiguration = typeof ProviderConfiguration.Type;

export const ConfigureProvider = Schema.Struct({
  providerId: ProviderId,
  configuration: ProviderConfiguration,
}).annotate({ message: "Invalid provider configuration." });
export type ConfigureProvider = typeof ConfigureProvider.Type;

export interface ProviderConfigurationRecord {
  readonly providerId: string;
  readonly configuration: ProviderConfiguration;
  readonly lastValidatedAt: number;
}

export class ProviderConfigurationStore extends Context.Service<
  ProviderConfigurationStore,
  {
    readonly read: (
      providerId: string,
    ) => Effect.Effect<ProviderConfigurationRecord | null, ProviderConnectionError>;
    readonly write: (
      record: ProviderConfigurationRecord,
    ) => Effect.Effect<void, ProviderConnectionError>;
    readonly remove: (providerId: string) => Effect.Effect<void, ProviderConnectionError>;
  }
>()("@stargeist/ai/ProviderConfigurationStore") {}
