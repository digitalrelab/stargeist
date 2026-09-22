import { Context, Effect, Layer, Schema } from "effect";
import { Model, ProviderId } from "./models";
import { ProviderConnectionError } from "./errors";
import { ProviderConfigurationStore } from "./configuration";
import { ProviderRegistry } from "./registry";

export const ProviderModelCatalogState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("notConfigured") }),
  Schema.Struct({
    status: Schema.Literal("available"),
    models: Schema.Array(Model).check(Schema.isMaxLength(2000)),
  }),
  Schema.Struct({ status: Schema.Literal("unavailable"), error: ProviderConnectionError }),
]);
export type ProviderModelCatalogState = typeof ProviderModelCatalogState.Type;

export const ProviderModelCatalog = Schema.Struct({
  providerId: ProviderId,
  displayName: Schema.NonEmptyString,
  state: ProviderModelCatalogState,
});
export type ProviderModelCatalog = typeof ProviderModelCatalog.Type;

export class ModelCatalog extends Context.Service<
  ModelCatalog,
  {
    readonly list: Effect.Effect<ReadonlyArray<ProviderModelCatalog>>;
  }
>()("@stargeist/ai/ModelCatalog") {}

export const modelCatalogLayer = Layer.effect(
  ModelCatalog,
  Effect.gen(function* () {
    const configurations = yield* ProviderConfigurationStore;
    const providers = yield* ProviderRegistry;
    const list = Effect.forEach(
      providers.all,
      (provider) =>
        configurations.read(provider.id).pipe(
          Effect.flatMap((record) => provider.open(record?.configuration ?? null)),
          Effect.flatMap((runtime) => runtime.models),
          Effect.map((models): ProviderModelCatalogState => ({ status: "available", models })),
          Effect.catch((error) => {
            if (error.code === "NotConfigured")
              return Effect.succeed<ProviderModelCatalogState>({ status: "notConfigured" });
            return Effect.succeed<ProviderModelCatalogState>({ status: "unavailable", error });
          }),
          Effect.map((state): ProviderModelCatalog => ({
            providerId: provider.id,
            displayName: provider.displayName,
            state,
          })),
        ),
      { concurrency: 4 },
    );
    return ModelCatalog.of({ list });
  }),
);
