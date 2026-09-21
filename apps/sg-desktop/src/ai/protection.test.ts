import { Effect, Redacted } from "effect";
import { expect, it } from "vite-plus/test";
import { createSecretProtection } from "./protection";

it.each(["v10", "raw", ""])(
  "rejects insecure or unknown Linux encryption output %s",
  async (prefix) => {
    const protection = createSecretProtection(
      {
        isAsyncEncryptionAvailable: async () => true,
        encryptStringAsync: async () => Buffer.from(`${prefix}ciphertext`),
        decryptStringAsync: async () => {
          throw new Error("Must not decrypt rejected ciphertext.");
        },
      },
      "linux",
    );
    expect(
      await Effect.runPromise(protection.encrypt(Redacted.make("secret")).pipe(Effect.flip)),
    ).toMatchObject({ code: "SecureStorageUnavailable" });
    expect(
      await Effect.runPromise(
        protection.decrypt(Buffer.from(`${prefix}ciphertext`)).pipe(Effect.flip),
      ),
    ).toMatchObject({ code: "CredentialUnreadable" });
  },
);

it.each(["v11", "v12"])(
  "accepts protected Linux output %s and returns rotation metadata",
  async (prefix) => {
    const protection = createSecretProtection(
      {
        isAsyncEncryptionAvailable: async () => true,
        encryptStringAsync: async () => Buffer.from(`${prefix}ciphertext`),
        decryptStringAsync: async () => ({ result: "secret", shouldReEncrypt: true }),
      },
      "linux",
    );
    const result = await Effect.runPromise(
      protection.encrypt(Redacted.make("secret")).pipe(Effect.flatMap(protection.decrypt)),
    );
    expect(Redacted.value(result.text)).toBe("secret");
    expect(result.shouldReEncrypt).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret");
  },
);

it("reports unavailable key stores without exposing native errors", async () => {
  const protection = createSecretProtection(
    {
      isAsyncEncryptionAvailable: async () => false,
      encryptStringAsync: async () => {
        throw new Error("secret");
      },
      decryptStringAsync: async () => {
        throw new Error("secret");
      },
    },
    "darwin",
  );
  const result = await Effect.runPromise(
    protection.encrypt(Redacted.make("secret")).pipe(Effect.flip),
  );
  expect(result.code).toBe("SecureStorageUnavailable");
  expect(JSON.stringify(result)).not.toContain("secret");
});
