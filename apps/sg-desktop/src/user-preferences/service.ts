import { basename, dirname } from "node:path";
import { UserPreferences, UserPreferencesError, UserPreferenceValues } from "@stargeist/domain";
import Store from "electron-store";
import { Effect, Layer, Queue, Schema, Stream } from "effect";
import { StoragePaths } from "../storage";

const decode = Schema.decodeUnknownSync(UserPreferenceValues, { onExcessProperty: "error" });
const defaults = decode({});

export const userPreferencesLayer = Layer.effect(
  UserPreferences,
  Effect.gen(function* () {
    const { userPreferences: path } = yield* StoragePaths;
    const failure = (operation: UserPreferencesError["operation"]) => (cause: unknown) =>
      new UserPreferencesError({
        operation,
        message: "User preferences could not be read or saved.",
        cause,
      });

    const store = yield* Effect.try({
      try: () =>
        new Store<UserPreferenceValues>({
          cwd: dirname(path),
          name: basename(path, ".json"),
          deserialize: (text) => decode(JSON.parse(text)),
          serialize: (values) => JSON.stringify(decode(values), undefined, "\t"),
          clearInvalidConfig: false,
          accessPropertiesByDotNotation: false,
        }),
      catch: failure("open"),
    });

    const get = <K extends keyof UserPreferenceValues>(key: K) =>
      Effect.try({
        try: () => store.get(key, defaults[key]),
        catch: failure("read"),
      });

    const set = <K extends keyof UserPreferenceValues>(key: K, value: UserPreferenceValues[K]) =>
      Effect.try({
        try: () => store.set(key, value),
        catch: failure("write"),
      });

    const watch = <K extends keyof UserPreferenceValues>(key: K) =>
      Stream.callback<UserPreferenceValues[K], UserPreferencesError>(
        Effect.fnUntraced(function* (queue) {
          yield* Effect.acquireRelease(
            Effect.try({
              try: () =>
                store.onDidChange(key, (value) => {
                  Queue.offerUnsafe(queue, value ?? defaults[key]);
                }),
              catch: failure("read"),
            }),
            (unsubscribe) => Effect.sync(unsubscribe),
          );
          yield* Queue.offer(queue, yield* get(key));
        }),
        { bufferSize: 1, strategy: "sliding" },
      );

    return { get, set, watch } satisfies UserPreferences["Service"];
  }),
);
