import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rename, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AIProviderConnections, ProviderConnectionError } from "@stargeist/domain/ai";
import { Deferred, Effect, Fiber, Layer, Redacted } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { pathsLayer } from "../storage";
import { connectionsLayer } from "./connections";
import { Credentials, type StoredCredential } from "./credentials";
import { SecretProtection } from "./protection";
import { credentialsLayer } from "./storage";

const record: StoredCredential = {
  version: 1,
  providerId: "first",
  credential: { kind: "apiKey", key: Redacted.make("a-secret-api-key") },
  lastValidatedAt: 1234,
};

async function fixture() {
  const profile = await mkdtemp(join(tmpdir(), "stargeist-credentials-"));
  onTestFinished(() => rm(profile, { recursive: true, force: true }));
  const key = randomBytes(32);
  let rotate = false;
  let locked = false;
  const failure = () =>
    new ProviderConnectionError({ code: "SecureStorageUnavailable", message: "Key store locked." });
  const protection: SecretProtection["Service"] = {
    encrypt: (text) =>
      Effect.try({
        try: () => {
          if (locked) throw new Error("locked");
          const iv = randomBytes(12);
          const cipher = createCipheriv("aes-256-gcm", key, iv);
          const bytes = Buffer.concat([cipher.update(Redacted.value(text)), cipher.final()]);
          return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
        },
        catch: failure,
      }),
    decrypt: (bytes) =>
      Effect.try({
        try: () => {
          if (locked) throw new Error("locked");
          const cipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
          cipher.setAuthTag(bytes.subarray(12, 28));
          const text = Buffer.concat([
            cipher.update(bytes.subarray(28)),
            cipher.final(),
          ]).toString();
          return { text: Redacted.make(text), shouldReEncrypt: rotate };
        },
        catch: failure,
      }),
  };
  const layer = credentialsLayer.pipe(
    Layer.provide(pathsLayer(profile)),
    Layer.provide(Layer.succeed(SecretProtection, protection)),
  );
  return {
    profile,
    layer,
    protection,
    rotate: () => {
      rotate = true;
    },
    lock: () => {
      locked = true;
    },
    unlock: () => {
      locked = false;
    },
  };
}

it("persists encrypted records across service restarts and rewrites rotated encryption atomically", async () => {
  const setup = await fixture();
  const file = join(setup.profile, "data", "credentials", "first.bin");
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Credentials;
      expect(yield* store.read("first")).toBeNull();
      yield* store.write(record);
    }).pipe(Effect.provide(setup.layer)),
  );
  const before = await readFile(file);
  expect(before.includes(Buffer.from("a-secret-api-key"))).toBe(false);
  if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
  setup.rotate();
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Credentials;
      const saved = yield* store.read("first");
      expect(saved?.lastValidatedAt).toBe(1234);
      expect(Redacted.value(saved!.credential.key)).toBe("a-secret-api-key");
    }).pipe(Effect.provide(setup.layer)),
  );
  expect(await readFile(file)).not.toEqual(before);
  expect(await readdir(join(setup.profile, "data", "credentials"))).toEqual(["first.bin"]);
});

it("keeps other providers usable during key rotation and prevents rotation from undoing removal", async () => {
  const setup = await fixture();
  await Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const finish = yield* Deferred.make<void>();
      const layer = credentialsLayer.pipe(
        Layer.provide(pathsLayer(setup.profile)),
        Layer.provide(
          Layer.succeed(SecretProtection, {
            ...setup.protection,
            decrypt: (bytes) =>
              Deferred.succeed(started, undefined).pipe(
                Effect.andThen(Deferred.await(finish)),
                Effect.andThen(setup.protection.decrypt(bytes)),
              ),
          }),
        ),
      );
      yield* Effect.gen(function* () {
        const store = yield* Credentials;
        yield* store.write(record);
        setup.rotate();
        const rotation = yield* store.read("first").pipe(Effect.forkChild);
        yield* Deferred.await(started);
        const removal = yield* store.remove("first").pipe(Effect.forkChild);
        yield* store.write({ ...record, providerId: "second" });
        yield* store.remove("second");
        yield* Deferred.succeed(finish, undefined);
        yield* Fiber.join(rotation);
        yield* Fiber.join(removal);
        expect(yield* store.read("first")).toBeNull();
        expect(yield* store.read("second")).toBeNull();
      }).pipe(Effect.provide(layer));
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});

it("preserves existing ciphertext on encryption failure and permits removal while locked", async () => {
  const setup = await fixture();
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Credentials;
      yield* store.write(record);
      setup.lock();
      expect(
        yield* store
          .write({ ...record, credential: { kind: "apiKey", key: Redacted.make("replacement") } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "SecureStorageUnavailable" });
      setup.unlock();
      expect(Redacted.value((yield* store.read("first"))!.credential.key)).toBe("a-secret-api-key");
      setup.lock();
      yield* store.remove("first");
      expect(yield* store.read("first")).toBeNull();
    }).pipe(Effect.provide(setup.layer)),
  );
});

it("surfaces unreadable credentials without failing startup and supports removal and reconfiguration", async () => {
  const setup = await fixture();
  const layer = connectionsLayer([
    {
      id: "first",
      displayName: "First provider",
      credentialKind: "apiKey",
      validate: () => Effect.void,
    },
  ]).pipe(Layer.provide(setup.layer));
  await Effect.runPromise(
    Effect.gen(function* () {
      const connections = yield* AIProviderConnections;
      yield* connections.configure({ providerId: "first", credential: record.credential });
      yield* Effect.promise(() =>
        writeFile(join(setup.profile, "data", "credentials", "first.bin"), Buffer.alloc(65537)),
      );
      expect((yield* connections.list)[0]?.state).toMatchObject({
        status: "unavailable",
        error: { code: "CredentialUnreadable" },
      });
      yield* connections.remove("first");
      yield* connections.configure({ providerId: "first", credential: record.credential });
      expect((yield* connections.list)[0]?.state.status).toBe("configured");
    }).pipe(Effect.provide(layer)),
  );
});

it("reports filesystem failures and retains the previous credential for recovery", async () => {
  const setup = await fixture();
  const data = join(setup.profile, "data");
  const backup = join(setup.profile, "saved-data");
  await Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Credentials;
      yield* store.write(record);
      yield* Effect.promise(async () => {
        await rename(data, backup);
        await writeFile(data, "not a directory");
      });
      expect(
        yield* store
          .write({ ...record, credential: { kind: "apiKey", key: Redacted.make("replacement") } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "StorageUnavailable" });
      expect(yield* store.read("first").pipe(Effect.flip)).toMatchObject({
        code: "StorageUnavailable",
      });
      yield* Effect.promise(async () => {
        await rm(data);
        await rename(backup, data);
      });
      expect(Redacted.value((yield* store.read("first"))!.credential.key)).toBe("a-secret-api-key");
      expect(yield* store.read("../escape").pipe(Effect.flip)).toMatchObject({
        code: "StorageUnavailable",
      });
    }).pipe(Effect.provide(setup.layer)),
  );
});
