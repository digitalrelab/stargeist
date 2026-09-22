import { AgentModelPreferenceError, AgentModelPreferences } from "@stargeist/domain/ai";
import { UserPreferences } from "@stargeist/domain";
import { Effect, Layer } from "effect";

const unavailable = () =>
  new AgentModelPreferenceError({
    message: "The default model could not be read or saved.",
  });

export const agentModelPreferencesLayer = Layer.effect(
  AgentModelPreferences,
  Effect.gen(function* () {
    const preferences = yield* UserPreferences;
    return AgentModelPreferences.of({
      getDefault: preferences.get("ai").pipe(
        Effect.map((values) => values.defaultAgentModel),
        Effect.mapError(unavailable),
      ),
      setDefault: Effect.fnUntraced(function* (model) {
        const values = yield* preferences.get("ai");
        yield* preferences.set("ai", { ...values, defaultAgentModel: model });
      }, Effect.mapError(unavailable)),
    });
  }),
);
