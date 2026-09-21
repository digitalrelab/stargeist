import {
  AIProviderConnections,
  ProviderConnectionError,
  type ProviderConnection,
  type ConfigureProvider,
  type ConnectionState,
  type ProviderCredential,
} from "@stargeist/domain/ai";
import { DateTime, Effect, Layer, Option, Redacted, Schema, Semaphore } from "effect";
import { Credentials, type StoredCredential } from "./credentials";
import type { ProviderAdapter } from "./provider";

const Key = Schema.Redacted(Schema.String.check(Schema.isPattern(/^[\x21-\x7e]{1,4096}$/)));

function connection(provider: ProviderAdapter, state: ConnectionState): ProviderConnection {
  return {
    providerId: provider.id,
    displayName: provider.displayName,
    credentialKind: provider.credentialKind,
    state,
  };
}

function configured(record: StoredCredential): ConnectionState {
  let keyHint = "••••";
  const key = Redacted.value(record.credential.key);
  if (key.length > 8) keyHint += key.slice(-4);
  return { status: "configured", keyHint, lastValidatedAt: record.lastValidatedAt };
}

export const connectionsLayer = (providers: ReadonlyArray<ProviderAdapter>) =>
  Layer.effect(
    AIProviderConnections,
    Effect.gen(function* () {
      const credentials = yield* Credentials;
      const entries = new Map<string, { adapter: ProviderAdapter; lock: Semaphore.Semaphore }>();
      for (const adapter of providers) {
        if (entries.has(adapter.id))
          return yield* Effect.die(new Error("Duplicate AI provider registration."));
        entries.set(adapter.id, { adapter, lock: yield* Semaphore.make(1) });
      }

      const mutate = <A>(
        id: string,
        run: (provider: ProviderAdapter) => Effect.Effect<A, ProviderConnectionError>,
      ) =>
        Effect.suspend(() => {
          const entry = entries.get(id);
          if (!entry)
            return Effect.fail(
              new ProviderConnectionError({
                code: "UnknownProvider",
                message: "This AI provider is not supported.",
              }),
            );
          return entry.lock
            .withPermitsIfAvailable(1)(run(entry.adapter))
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
            );
        });

      const validateAndSave = Effect.fnUntraced(function* (
        provider: ProviderAdapter,
        credential: ProviderCredential,
      ) {
        yield* provider.validate(credential);
        const now = yield* DateTime.now;
        const record: StoredCredential = {
          version: 1,
          providerId: provider.id,
          credential,
          lastValidatedAt: DateTime.toEpochMillis(now),
        };
        yield* credentials.write(record);
        return connection(provider, configured(record));
      });

      const configure = (input: ConfigureProvider) =>
        mutate(
          input.providerId,
          Effect.fnUntraced(function* (provider) {
            yield* Schema.decodeUnknownEffect(Key)(input.credential.key).pipe(
              Effect.mapError(
                () =>
                  new ProviderConnectionError({
                    code: "InvalidCredential",
                    message: "Enter a valid API key without spaces.",
                  }),
              ),
            );
            return yield* validateAndSave(provider, input.credential);
          }),
        );

      const check = (id: string) =>
        mutate(
          id,
          Effect.fnUntraced(function* (provider) {
            const record = yield* credentials.read(id);
            if (!record)
              return yield* new ProviderConnectionError({
                code: "NotConfigured",
                message: "Add an API key first.",
              });
            return yield* validateAndSave(provider, record.credential);
          }),
        );

      const list = Effect.forEach(
        providers,
        (provider) =>
          credentials.read(provider.id).pipe(
            Effect.map((record): ConnectionState => {
              if (record) return configured(record);
              return { status: "notConfigured" };
            }),
            Effect.catch((error) =>
              Effect.succeed<ConnectionState>({ status: "unavailable", error }),
            ),
            Effect.map((state) => connection(provider, state)),
          ),
        { concurrency: 4 },
      );

      return AIProviderConnections.of({
        list,
        configure,
        check,
        remove: (id) => mutate(id, () => credentials.remove(id)),
      });
    }),
  );
