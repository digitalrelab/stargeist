import { ProviderConnectionError } from "@stargeist/domain";
import { Context, Effect, Redacted } from "effect";

export class SecretProtection extends Context.Service<
  SecretProtection,
  {
    readonly encrypt: (
      text: Redacted.Redacted<string>,
    ) => Effect.Effect<Buffer, ProviderConnectionError>;
    readonly decrypt: (
      bytes: Buffer,
    ) => Effect.Effect<
      { text: Redacted.Redacted<string>; shouldReEncrypt: boolean },
      ProviderConnectionError
    >;
  }
>()("@stargeist/desktop/ai/SecretProtection") {}

type NativeStorage = Pick<
  Electron.SafeStorage,
  "isAsyncEncryptionAvailable" | "encryptStringAsync" | "decryptStringAsync"
>;

const unavailable = () =>
  new ProviderConnectionError({
    code: "SecureStorageUnavailable",
    message:
      "Secure credential storage is unavailable. Unlock your system key store and try again.",
  });

export function createSecretProtection(
  native: NativeStorage,
  platform: NodeJS.Platform,
): SecretProtection["Service"] {
  const protectedCiphertext = (bytes: Buffer) => {
    if (bytes.length < 4) return false;
    if (platform !== "linux") return true;
    const prefix = bytes.subarray(0, 3).toString("ascii");
    return prefix === "v11" || prefix === "v12";
  };

  const available = Effect.tryPromise({
    try: () => native.isAsyncEncryptionAvailable(),
    catch: unavailable,
  }).pipe(
    Effect.flatMap((ready) => {
      if (ready) return Effect.void;
      return Effect.fail(unavailable());
    }),
  );

  return {
    encrypt: Effect.fnUntraced(function* (text) {
      yield* available;
      const bytes = yield* Effect.tryPromise({
        try: () => native.encryptStringAsync(Redacted.value(text)),
        catch: unavailable,
      });
      if (!protectedCiphertext(bytes)) return yield* unavailable();
      return bytes;
    }),
    decrypt: Effect.fnUntraced(function* (bytes) {
      if (!protectedCiphertext(bytes))
        return yield* new ProviderConnectionError({
          code: "CredentialUnreadable",
          message: "The saved credential cannot be read securely. Replace or remove it.",
        });
      yield* available;
      const result = yield* Effect.tryPromise({
        try: () => native.decryptStringAsync(bytes),
        catch: () =>
          new ProviderConnectionError({
            code: "CredentialUnreadable",
            message:
              "The saved credential could not be decrypted. Unlock your system key store, or replace or remove the credential.",
          }),
      });
      return { text: Redacted.make(result.result), shouldReEncrypt: result.shouldReEncrypt };
    }),
  };
}
