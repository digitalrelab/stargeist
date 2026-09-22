import {
  AgentModelPreferences,
  UserPreferences,
  UserPreferencesError,
  type UserPreferenceValues,
} from "@stargeist/domain";
import { Effect, Layer, Stream } from "effect";
import { expect, it } from "vite-plus/test";
import { agentModelPreferencesLayer } from "./preferences";

it("reads and replaces the persisted default without exposing storage failures", async () => {
  let values: UserPreferenceValues = {
    ai: { defaultAgentModel: null },
    interfaceScale: 1,
    window: null,
  };
  let fail = false;
  const service: UserPreferences["Service"] = {
    get: (key) =>
      Effect.suspend(() => {
        if (fail)
          return Effect.fail(
            new UserPreferencesError({ operation: "read", message: "Private failure", cause: {} }),
          );
        return Effect.succeed(values[key]);
      }),
    set: (key, value) => {
      if (fail)
        return Effect.fail(
          new UserPreferencesError({ operation: "write", message: "Private failure", cause: {} }),
        );
      return Effect.sync(() => {
        values = { ...values, [key]: value };
      });
    },
    watch: (key) => Stream.succeed(values[key]),
  };
  const preferences = Layer.succeed(UserPreferences, service);
  await Effect.runPromise(
    Effect.gen(function* () {
      const models = yield* AgentModelPreferences;
      expect(yield* models.getDefault).toBeNull();
      const selected = { providerId: "openrouter", modelId: "publisher/model" };
      yield* models.setDefault(selected);
      expect(yield* models.getDefault).toEqual(selected);
      const replacement = { providerId: "openrouter", modelId: "publisher/replacement" };
      yield* models.setDefault(replacement);
      expect(yield* models.getDefault).toEqual(replacement);
      fail = true;
      expect(yield* models.getDefault.pipe(Effect.flip)).toMatchObject({
        _tag: "AgentModelPreferenceError",
        message: "The default model could not be read or saved.",
      });
    }).pipe(Effect.provide(agentModelPreferencesLayer.pipe(Layer.provide(preferences)))),
  );
});
