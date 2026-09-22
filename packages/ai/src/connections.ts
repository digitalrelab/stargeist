import { Context, DateTime, Effect, Layer, Option, Schema, Semaphore } from "effect";
import { ProviderConnectionError } from "./errors";
import { ProviderId } from "./models";
import { ProviderConfigurationStore, type ConfigureProvider } from "./configuration";
import type { Adapter } from "./provider";
import { ProviderRegistry } from "./registry";

export const ConnectionState = Schema.Union([
  Schema.Struct({ status: Schema.Literal("notConfigured") }),
  Schema.Struct({
    status: Schema.Literal("configured"),
    summary: Schema.NullOr(Schema.String),
    lastValidatedAt: Schema.Number,
  }),
  Schema.Struct({ status: Schema.Literal("unavailable"), error: ProviderConnectionError }),
]);
export type ConnectionState = typeof ConnectionState.Type;

export const ProviderConnection = Schema.Struct({
  providerId: ProviderId,
  displayName: Schema.NonEmptyString,
  state: ConnectionState,
});
export type ProviderConnection = typeof ProviderConnection.Type;

export class ProviderConnections extends Context.Service<
  ProviderConnections,
  {
    readonly list: Effect.Effect<ReadonlyArray<ProviderConnection>>;
    readonly configure: (
      input: ConfigureProvider,
    ) => Effect.Effect<ProviderConnection, ProviderConnectionError>;
    readonly check: (
      providerId: string,
    ) => Effect.Effect<ProviderConnection, ProviderConnectionError>;
    readonly remove: (providerId: string) => Effect.Effect<void, ProviderConnectionError>;
  }
>()("@stargeist/ai/ProviderConnections") {}

function connection(provider: Adapter, state: ConnectionState): ProviderConnection {
  return {
    providerId: provider.id,
    displayName: provider.displayName,
    state,
  };
}

function configured(summary: string | null, lastValidatedAt: number): ConnectionState {
  return { status: "configured", summary, lastValidatedAt };
}

export const connectionsLayer = Layer.effect(
  ProviderConnections,
  Effect.gen(function* () {
    const configurations = yield* ProviderConfigurationStore;
    const providers = yield* ProviderRegistry;
    const locks = new Map<string, Semaphore.Semaphore>();
    const lastValidatedAtByProvider = new Map<string, number>();
    for (const adapter of providers.all) {
      locks.set(adapter.id, yield* Semaphore.make(1));
    }

    const runExclusive = <A>(
      id: string,
      run: (provider: Adapter) => Effect.Effect<A, ProviderConnectionError>,
    ) =>
      providers.get(id).pipe(
        Effect.flatMap((provider) =>
          locks
            .get(id)!
            .withPermitsIfAvailable(1)(run(provider))
            .pipe(
              Effect.flatMap((result) => {
                if (Option.isSome(result)) return Effect.succeed(result.value);
                return Effect.fail(
                  new ProviderConnectionError({
                    code: "Busy",
                    message:
                      "A connection change is already in progress. Try again when it finishes.",
                  }),
                );
              }),
            ),
        ),
      );

    const configure = (input: ConfigureProvider) =>
      runExclusive(
        input.providerId,
        Effect.fnUntraced(function* (provider) {
          const runtime = yield* provider.open(input.configuration);
          yield* runtime.check;
          const lastValidatedAt = DateTime.toEpochMillis(yield* DateTime.now);
          yield* configurations.write({
            providerId: provider.id,
            configuration: runtime.configuration,
            lastValidatedAt,
          });
          lastValidatedAtByProvider.set(provider.id, lastValidatedAt);
          return connection(provider, configured(runtime.summary, lastValidatedAt));
        }),
      );

    const check = (id: string) =>
      runExclusive(
        id,
        Effect.fnUntraced(function* (provider) {
          const record = yield* configurations.read(id);
          const runtime = yield* provider.open(record?.configuration ?? null);
          yield* runtime.check;
          const now = yield* DateTime.now;
          const lastValidatedAt = DateTime.toEpochMillis(now);
          lastValidatedAtByProvider.set(provider.id, lastValidatedAt);
          return connection(provider, configured(runtime.summary, lastValidatedAt));
        }),
      );

    const list = Effect.forEach(
      providers.all,
      (provider) =>
        configurations.read(provider.id).pipe(
          Effect.flatMap((record) =>
            provider
              .open(record?.configuration ?? null)
              .pipe(
                Effect.map((runtime) =>
                  configured(
                    runtime.summary,
                    lastValidatedAtByProvider.get(provider.id) ?? record?.lastValidatedAt ?? 0,
                  ),
                ),
              ),
          ),
          Effect.catch((error) => {
            if (error.code === "NotConfigured")
              return Effect.succeed<ConnectionState>({ status: "notConfigured" });
            return Effect.succeed<ConnectionState>({ status: "unavailable", error });
          }),
          Effect.map((state) => connection(provider, state)),
        ),
      { concurrency: 4 },
    );

    return ProviderConnections.of({
      list,
      configure,
      check,
      remove: (id) =>
        runExclusive(
          id,
          Effect.fnUntraced(function* () {
            yield* configurations.remove(id);
            lastValidatedAtByProvider.delete(id);
          }),
        ),
    });
  }),
);
