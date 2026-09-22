import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { ProviderConnectionError, ProviderId } from "@stargeist/domain";
import { Effect, Layer, Predicate, RcMap, Redacted, Schema, Semaphore } from "effect";
import { StoragePaths } from "../storage";
import { Credentials, StoredCredential } from "./credentials";
import { SecretProtection } from "./protection";

const storageFailure = () =>
  new ProviderConnectionError({
    code: "StorageUnavailable",
    message:
      "Credentials could not be read or saved. Check access to the app data directory and try again.",
  });
const unreadable = () =>
  new ProviderConnectionError({
    code: "CredentialUnreadable",
    message: "The saved credential is unreadable. Replace or remove it.",
  });
const codec = Schema.fromJsonString(Schema.toCodecJson(StoredCredential));
const missing = (error: unknown) => Predicate.hasProperty(error, "code") && error.code === "ENOENT";
const maxCredentialBytes = 64 * 1024;

export const credentialsLayer = Layer.effect(
  Credentials,
  Effect.gen(function* () {
    const { credentials: directory } = yield* StoragePaths;
    const protection = yield* SecretProtection;
    const locks = yield* RcMap.make({ lookup: (_id: string) => Semaphore.make(1) });
    const withLock = <A, E>(id: string, operation: Effect.Effect<A, E>) =>
      RcMap.get(locks, id).pipe(
        Effect.flatMap((lock) => lock.withPermit(operation)),
        Effect.scoped,
      );
    const path = (id: string) =>
      Schema.decodeUnknownEffect(ProviderId)(id).pipe(
        Effect.map((valid) => join(directory, `${valid}.bin`)),
        Effect.mapError(storageFailure),
      );

    const persist = (filename: string, bytes: Buffer) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(directory, { recursive: true, mode: 0o700 });
          const temporary = join(directory, `.${randomUUID()}.tmp`);
          try {
            const file = await open(temporary, "wx", 0o600);
            try {
              await file.writeFile(bytes);
              await file.sync();
            } finally {
              await file.close();
            }
            await rename(temporary, filename);
          } finally {
            await rm(temporary, { force: true });
          }
        },
        catch: storageFailure,
      }).pipe(Effect.uninterruptible);

    const write = Effect.fnUntraced(function* (record: StoredCredential) {
      const filename = yield* path(record.providerId);
      const text = yield* Schema.encodeEffect(codec)(record).pipe(
        Effect.mapError(storageFailure),
        Effect.map(Redacted.make),
      );
      const encrypted = yield* protection.encrypt(text);
      yield* persist(filename, encrypted);
    });

    const read = Effect.fnUntraced(function* (id: string) {
      const filename = yield* path(id);
      const bytes = yield* Effect.tryPromise({
        try: async () => {
          let file;
          try {
            file = await open(filename, "r");
          } catch (error) {
            if (missing(error)) return null;
            throw error;
          }
          try {
            const buffer = Buffer.alloc(maxCredentialBytes + 1);
            let length = 0;
            while (length < buffer.length) {
              const result = await file.read(buffer, length, buffer.length - length, length);
              if (result.bytesRead === 0) break;
              length += result.bytesRead;
            }
            return buffer.subarray(0, length);
          } finally {
            await file.close();
          }
        },
        catch: storageFailure,
      });
      if (bytes === null) return null;
      if (bytes.length > maxCredentialBytes) return yield* unreadable();
      const decrypted = yield* protection.decrypt(bytes);
      const record = yield* Schema.decodeUnknownEffect(codec)(Redacted.value(decrypted.text)).pipe(
        Effect.mapError(unreadable),
      );
      if (record.providerId !== id) return yield* unreadable();
      if (decrypted.shouldReEncrypt) yield* write(record);
      return record;
    });

    const remove = Effect.fnUntraced(function* (id: string) {
      const filename = yield* path(id);
      yield* Effect.tryPromise({
        try: () => rm(filename, { force: true }),
        catch: storageFailure,
      }).pipe(Effect.uninterruptible);
    });

    return Credentials.of({
      read: (id) => withLock(id, read(id)),
      write: (record) => withLock(record.providerId, write(record)),
      remove: (id) => withLock(id, remove(id)),
    });
  }),
);
