import { ProviderConnectionError, ProviderConnections } from "./index";
import { Effect, Layer, Redacted, Schema } from "effect";
import { expect, it } from "vite-plus/test";
import { ModelCatalog, modelCatalogLayer } from "./catalog";
import { ProviderConfigurationStore, type ProviderConfigurationRecord } from "./configuration";
import { connectionsLayer } from "./connections";
import * as AIProvider from "./provider";
import { registryLayer } from "./registry";

const Configuration = Schema.Redacted(Schema.String);

it("isolates provider catalog states and keeps credentials inside adapters", async () => {
  const records = new Map<string, ProviderConfigurationRecord>([
    [
      "first",
      {
        providerId: "first",
        configuration: Redacted.make("first-secret"),
        lastValidatedAt: 1,
      },
    ],
    [
      "third",
      {
        providerId: "third",
        configuration: Redacted.make("third-secret"),
        lastValidatedAt: 1,
      },
    ],
  ]);
  const store = Layer.succeed(ProviderConfigurationStore, {
    read: (id) => Effect.succeed(records.get(id) ?? null),
    write: () => Effect.die("Unexpected write"),
    remove: () => Effect.die("Unexpected removal"),
  });
  const unavailable = new ProviderConnectionError({
    code: "NetworkUnavailable",
    message: "Cannot load models.",
  });
  const providers = registryLayer([
    AIProvider.define({
      id: "first",
      displayName: "First provider",
      configuration: Configuration,
    })(
      Effect.succeed({
        describe: () => null,
        check: () => Effect.void,
        models: (saved) => {
          expect(Redacted.value(saved)).toBe("first-secret");
          return Effect.succeed([
            {
              id: "publisher/model",
              name: "Model",
              publisher: { id: "publisher", name: "Publisher" },
              pricing: null,
              capabilities: {
                toolCalling: false,
                reasoning: false,
                inputModalities: ["text"],
                outputModalities: ["image"],
              },
            },
          ]);
        },
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
        models: () => Effect.die("Unconfigured provider was queried"),
      }),
    ),
    AIProvider.define({
      id: "third",
      displayName: "Third provider",
      configuration: Configuration,
    })(
      Effect.succeed({
        describe: () => null,
        check: () => Effect.void,
        models: () => Effect.fail(unavailable),
      }),
    ),
    AIProvider.define({
      id: "local",
      displayName: "Local provider",
      configuration: Schema.Null,
    })(
      Effect.succeed({
        describe: () => null,
        check: () => Effect.void,
        models: () =>
          Effect.succeed([
            {
              id: "local-model",
              name: "Local model",
              publisher: { id: "local", name: "Local" },
              pricing: null,
              capabilities: {
                toolCalling: false,
                reasoning: false,
                inputModalities: ["text"],
                outputModalities: ["image"],
              },
            },
          ]),
      }),
    ),
  ]);

  const catalogs = await Effect.runPromise(
    Effect.gen(function* () {
      const connections = yield* ProviderConnections;
      expect(
        (yield* connections.list).find((provider) => provider.providerId === "local")?.state,
      ).toMatchObject({ status: "configured", summary: null });
      expect((yield* connections.check("local")).state.status).toBe("configured");
      return yield* (yield* ModelCatalog).list;
    }).pipe(
      Effect.provide(
        Layer.merge(modelCatalogLayer, connectionsLayer).pipe(
          Layer.provide(providers),
          Layer.provide(store),
        ),
      ),
    ),
  );

  expect(catalogs).toEqual([
    {
      providerId: "first",
      displayName: "First provider",
      state: {
        status: "available",
        models: [
          {
            reference: { providerId: "first", modelId: "publisher/model" },
            name: "Model",
            publisher: { id: "publisher", name: "Publisher" },
            pricing: null,
            capabilities: {
              toolCalling: false,
              reasoning: false,
              inputModalities: ["text"],
              outputModalities: ["image"],
            },
          },
        ],
      },
    },
    {
      providerId: "second",
      displayName: "Second provider",
      state: { status: "notConfigured" },
    },
    {
      providerId: "third",
      displayName: "Third provider",
      state: { status: "unavailable", error: unavailable },
    },
    {
      providerId: "local",
      displayName: "Local provider",
      state: {
        status: "available",
        models: [
          {
            reference: { providerId: "local", modelId: "local-model" },
            name: "Local model",
            publisher: { id: "local", name: "Local" },
            pricing: null,
            capabilities: {
              toolCalling: false,
              reasoning: false,
              inputModalities: ["text"],
              outputModalities: ["image"],
            },
          },
        ],
      },
    },
  ]);
});
