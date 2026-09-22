import { ProviderConnectionError } from "./errors";
import { Model, ModelId, ProviderId } from "./models";
import type { ProviderConfiguration } from "./configuration";
import { Effect, Redacted, Schema } from "effect";

export type ModelDescriptor = Omit<Model, "reference"> & { readonly id: string };

export interface Implementation<Configuration> {
  readonly describe: (configuration: Configuration) => string | null;
  readonly check: (configuration: Configuration) => Effect.Effect<void, ProviderConnectionError>;
  readonly models: (
    configuration: Configuration,
  ) => Effect.Effect<ReadonlyArray<ModelDescriptor>, ProviderConnectionError>;
}

export interface Runtime {
  readonly configuration: ProviderConfiguration;
  readonly summary: string | null;
  readonly check: Effect.Effect<void, ProviderConnectionError>;
  readonly models: Effect.Effect<ReadonlyArray<Model>, ProviderConnectionError>;
}

export interface Adapter {
  readonly id: string;
  readonly displayName: string;
  readonly open: (
    configuration: ProviderConfiguration | null,
  ) => Effect.Effect<Runtime, ProviderConnectionError>;
}

export interface Definition<E = never, R = never> {
  readonly id: string;
  readonly displayName: string;
  readonly make: Effect.Effect<Adapter, E, R>;
}

const Descriptor = Schema.Struct({ id: ProviderId, displayName: Schema.NonEmptyString });
const ModelDescriptors = Schema.Array(
  Schema.Struct({
    id: ModelId,
    name: Model.fields.name,
    publisher: Model.fields.publisher,
    pricing: Model.fields.pricing,
    capabilities: Model.fields.capabilities,
  }),
).check(Schema.isMaxLength(2000));
const invalidConfiguration = () =>
  new ProviderConnectionError({
    code: "InvalidConfiguration",
    message: "The provider settings are invalid. Update them to reconnect.",
  });
const invalidCatalog = () =>
  new ProviderConnectionError({
    code: "InvalidResponse",
    message: "The provider returned an invalid model catalog.",
  });

export function define<Configuration extends Schema.Codec<unknown, unknown>>(options: {
  readonly id: string;
  readonly displayName: string;
  readonly configuration: Configuration;
}) {
  const descriptor = Schema.decodeUnknownSync(Descriptor)(options);
  const codec = Schema.toCodecJson(options.configuration);
  const decode = Schema.decodeUnknownEffect(codec);
  const encode = Schema.encodeEffect(codec);

  return <E, R>(
    make: Effect.Effect<Implementation<Configuration["Type"]>, E, R>,
  ): Definition<E, R> =>
    Object.freeze({
      ...descriptor,
      make: make.pipe(
        Effect.map((implementation): Adapter => ({
          ...descriptor,
          open: Effect.fnUntraced(function* (input) {
            let raw: unknown = null;
            if (input !== null) raw = Redacted.value(input);
            const configuration = yield* decode(raw).pipe(
              Effect.mapError(() => {
                if (input !== null) return invalidConfiguration();
                return new ProviderConnectionError({
                  code: "NotConfigured",
                  message: "Configure this provider to connect.",
                });
              }),
            );
            const encoded = yield* encode(configuration).pipe(
              Effect.mapError(invalidConfiguration),
            );
            return {
              configuration: Redacted.make(encoded),
              summary: implementation.describe(configuration),
              check: Effect.suspend(() => implementation.check(configuration)),
              models: Effect.suspend(() => implementation.models(configuration)).pipe(
                Effect.flatMap((models) => Schema.decodeUnknownEffect(ModelDescriptors)(models)),
                Effect.mapError((error) => {
                  if (error instanceof ProviderConnectionError) return error;
                  return invalidCatalog();
                }),
                Effect.flatMap((models) => {
                  const identifiers = new Set<string>();
                  const catalog: Model[] = [];
                  for (const { id, ...model } of models) {
                    if (identifiers.has(id)) {
                      return Effect.fail(
                        new ProviderConnectionError({
                          code: "InvalidResponse",
                          message: "The provider returned duplicate model identifiers.",
                        }),
                      );
                    }
                    identifiers.add(id);
                    catalog.push({
                      ...model,
                      reference: { providerId: descriptor.id, modelId: id },
                    });
                  }
                  return Effect.succeed(catalog);
                }),
              ),
            };
          }),
        })),
      ),
    });
}
