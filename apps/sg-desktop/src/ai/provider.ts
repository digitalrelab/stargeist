import type { ProviderConnectionError, ProviderCredential } from "@stargeist/domain";
import type { Effect } from "effect";

export interface ProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly credentialKind: "apiKey";
  readonly validate: (
    credential: ProviderCredential,
  ) => Effect.Effect<void, ProviderConnectionError>;
}
