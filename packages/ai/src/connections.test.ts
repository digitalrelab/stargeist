import { ProviderConnections, ProviderConnectionError, type ProviderConfiguration } from "./index";
import { Deferred, Effect, Fiber, Layer, Redacted, Schema } from "effect";
import { TestClock } from "effect/testing";
import { expect, it } from "vite-plus/test";
import { connectionsLayer } from "./connections";
import { ProviderConfigurationStore, type ProviderConfigurationRecord } from "./configuration";
import * as AIProvider from "./provider";
import { registryLayer } from "./registry";

const Configuration = Schema.Redacted(
  Schema.String.check(Schema.isPattern(/^[\x21-\x7E]{1,4096}$/)),
);
const configuration = (key: string): ProviderConfiguration => Redacted.make(key);
const rejected = new ProviderConnectionError({
  code: "InvalidCredential",
  message: "Rejected key.",
});

function fixture(
  check: AIProvider.Implementation<typeof Configuration.Type>["check"] = () => Effect.void,
) {
  const records = new Map<string, ProviderConfigurationRecord>();
  let failWrite = false;
  let writes = 0;
  const store: ProviderConfigurationStore["Service"] = {
    read: (id) => Effect.sync(() => records.get(id) ?? null),
    write: (record) =>
      Effect.suspend(() => {
        if (failWrite)
          return Effect.fail(
            new ProviderConnectionError({ code: "StorageUnavailable", message: "Cannot save." }),
          );
        return Effect.sync(() => {
          writes += 1;
          records.set(record.providerId, record);
        });
      }),
    remove: (id) =>
      Effect.sync(() => {
        records.delete(id);
      }),
  };
  const providers = registryLayer([
    AIProvider.define({
      id: "first",
      displayName: "First provider",
      configuration: Configuration,
    })(
      Effect.succeed({
        describe: (key) => `••••${Redacted.value(key).slice(-4)}`,
        check,
        models: () => Effect.succeed([]),
      }),
    ),
    AIProvider.define({
      id: "second",
      displayName: "Second provider",
      configuration: Configuration,
    })(
      Effect.succeed({
        describe: () => null,
        check: () => Effect.void,
        models: () => Effect.succeed([]),
      }),
    ),
  ]);
  return {
    failWrites: () => {
      failWrite = true;
    },
    writes: () => writes,
    layer: connectionsLayer.pipe(
      Layer.provide(providers),
      Layer.provide(Layer.succeed(ProviderConfigurationStore, store)),
    ),
  };
}

it("isolates providers and preserves the saved key through failed validation and failed persistence", async () => {
  const setup = fixture((input) => {
    if (Redacted.value(input) === "rejected-secret") return Effect.fail(rejected);
    return Effect.void;
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      const connections = yield* ProviderConnections;
      expect((yield* connections.list).map((p) => p.state.status)).toEqual([
        "notConfigured",
        "notConfigured",
      ]);
      const saved = yield* connections.configure({
        providerId: "first",
        configuration: configuration("first-secret-1234"),
      });
      expect(saved.state).toMatchObject({ status: "configured", summary: "••••1234" });
      expect(JSON.stringify(saved)).not.toContain("first-secret");
      expect(
        yield* connections
          .configure({ providerId: "first", configuration: configuration("rejected-secret") })
          .pipe(Effect.flip),
      ).toEqual(rejected);
      setup.failWrites();
      expect(
        yield* connections
          .configure({ providerId: "first", configuration: configuration("replacement-secret") })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "StorageUnavailable" });
      expect(yield* connections.list).toEqual([
        saved,
        {
          providerId: "second",
          displayName: "Second provider",
          state: { status: "notConfigured" },
        },
      ]);
      yield* connections.remove("first");
      yield* connections.remove("first");
      expect(yield* connections.check("first").pipe(Effect.flip)).toMatchObject({
        code: "NotConfigured",
      });
    }).pipe(Effect.provide(setup.layer)),
  );
});

it("keeps other providers and local status usable during validation and rejects conflicting changes", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const setup = fixture(() =>
        Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)),
      );
      yield* Effect.gen(function* () {
        const connections = yield* ProviderConnections;
        const pending = yield* connections
          .configure({ providerId: "first", configuration: configuration("first-secret") })
          .pipe(Effect.forkChild);
        yield* Deferred.await(started);
        expect(yield* connections.remove("first").pipe(Effect.flip)).toMatchObject({
          code: "Busy",
        });
        expect((yield* connections.list)[0]?.state.status).toBe("notConfigured");
        yield* connections.configure({
          providerId: "second",
          configuration: configuration("second-secret"),
        });
        yield* Fiber.interrupt(pending);
        yield* connections.remove("first");
        expect((yield* connections.list).map((provider) => provider.state.status)).toEqual([
          "notConfigured",
          "configured",
        ]);
      }).pipe(Effect.provide(setup.layer));
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});

it("reports failed checks without discarding credentials, and supports replacing and adding again", async () => {
  let valid = true;
  const setup = fixture(() => {
    if (valid) return Effect.void;
    return Effect.fail(rejected);
  });
  await Effect.runPromise(
    Effect.gen(function* () {
      const connections = yield* ProviderConnections;
      const original = yield* connections.configure({
        providerId: "first",
        configuration: configuration("original-key"),
      });
      valid = false;
      yield* TestClock.adjust("1 second");
      expect(yield* connections.check("first").pipe(Effect.flip)).toEqual(rejected);
      expect((yield* connections.list)[0]).toEqual(original);
      valid = true;
      yield* connections.configure({
        providerId: "first",
        configuration: configuration("new-key-5678"),
      });
      yield* TestClock.adjust("1 second");
      const checked = yield* connections.check("first");
      expect(checked.state).toEqual({
        status: "configured",
        summary: "••••5678",
        lastValidatedAt: 2000,
      });
      expect(setup.writes()).toBe(2);
      expect((yield* connections.list)[0]).toEqual(checked);
      yield* connections.remove("first");
      yield* connections.configure({
        providerId: "first",
        configuration: configuration("third-key-9012"),
      });
      expect((yield* connections.list)[0]?.state).toMatchObject({ summary: "••••9012" });
      expect(
        yield* connections
          .configure({ providerId: "first", configuration: configuration("bad\nsecret") })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "InvalidConfiguration" });
      expect(yield* connections.remove("unknown").pipe(Effect.flip)).toMatchObject({
        code: "UnknownProvider",
      });
    }).pipe(Effect.provide(setup.layer), Effect.provide(TestClock.layer())),
  );
});
