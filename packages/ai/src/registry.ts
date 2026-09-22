import { ProviderConnectionError } from "./errors";
import { Context, Effect, Layer, type Scope } from "effect";
import type { Adapter, Definition } from "./provider";

export class ProviderRegistry extends Context.Service<
  ProviderRegistry,
  {
    readonly all: ReadonlyArray<Adapter>;
    readonly get: (id: string) => Effect.Effect<Adapter, ProviderConnectionError>;
  }
>()("@stargeist/ai/ProviderRegistry") {}

export function registryLayer<const Providers extends ReadonlyArray<Definition<unknown, unknown>>>(
  definitions: Providers,
): Layer.Layer<
  ProviderRegistry,
  Effect.Error<Providers[number]["make"]>,
  Exclude<Effect.Services<Providers[number]["make"]>, Scope.Scope>
>;
export function registryLayer(definitions: ReadonlyArray<Definition<unknown, unknown>>) {
  return Layer.effect(
    ProviderRegistry,
    Effect.gen(function* () {
      const identifiers = new Set<string>();
      for (const definition of definitions) {
        if (identifiers.has(definition.id)) {
          return yield* Effect.die(
            new Error(`Duplicate AI provider registration: ${definition.id}`),
          );
        }
        identifiers.add(definition.id);
      }
      const all = yield* Effect.forEach(definitions, (definition) => definition.make, {
        concurrency: 4,
      });
      const byId = new Map(all.map((provider) => [provider.id, provider]));
      return ProviderRegistry.of({
        all,
        get: (id) =>
          Effect.suspend(() => {
            const provider = byId.get(id);
            if (provider) return Effect.succeed(provider);
            return Effect.fail(
              new ProviderConnectionError({
                code: "UnknownProvider",
                message: "This AI provider is not supported.",
              }),
            );
          }),
      });
    }),
  );
}
