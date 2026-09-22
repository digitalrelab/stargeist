import { ModelCatalog, type ModelReference, type ProviderModelCatalog } from "@stargeist/ai";
import { Context, Effect, Layer, Schema } from "effect";

export class AgentModelPreferenceError extends Schema.TaggedError<AgentModelPreferenceError>()(
  "AgentModelPreferenceError",
  {
    message: Schema.String,
  },
) {}

export class AgentModelCatalog extends Context.Service<
  AgentModelCatalog,
  { readonly list: Effect.Effect<ReadonlyArray<ProviderModelCatalog>> }
>()("@stargeist/domain/AgentModelCatalog") {
  static readonly layer = Layer.effect(
    AgentModelCatalog,
    Effect.gen(function* () {
      const catalog = yield* ModelCatalog;
      return AgentModelCatalog.of({
        list: catalog.list.pipe(
          Effect.map((providers) =>
            providers.map((provider) => {
              if (provider.state.status !== "available") return provider;
              return {
                ...provider,
                state: {
                  status: "available" as const,
                  models: provider.state.models.filter(
                    (model) =>
                      model.capabilities.toolCalling &&
                      model.capabilities.outputModalities.includes("text"),
                  ),
                },
              };
            }),
          ),
        ),
      });
    }),
  );
}

export class AgentModelPreferences extends Context.Service<
  AgentModelPreferences,
  {
    readonly getDefault: Effect.Effect<ModelReference | null, AgentModelPreferenceError>;
    readonly setDefault: (model: ModelReference) => Effect.Effect<void, AgentModelPreferenceError>;
  }
>()("@stargeist/domain/AgentModelPreferences") {}
