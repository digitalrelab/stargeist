import { Schema } from "effect";

export class ProviderConnectionError extends Schema.TaggedError<ProviderConnectionError>()(
  "ProviderConnectionError",
  {
    code: Schema.Literals([
      "UnknownProvider",
      "InvalidCredential",
      "InvalidConfiguration",
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
