import { Effect, Schema } from "effect";
import { ModelReference } from "@stargeist/ai";

export const InterfaceScale = Schema.Literals([0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]);
export type InterfaceScale = typeof InterfaceScale.Type;

const WindowState = Schema.Struct({
  bounds: Schema.Struct({
    x: Schema.Int,
    y: Schema.Int,
    width: Schema.Int.check(Schema.isGreaterThan(0)),
    height: Schema.Int.check(Schema.isGreaterThan(0)),
  }),
  maximized: Schema.Boolean,
  fullScreen: Schema.Boolean,
});

const AIPreferences = Schema.Struct({
  defaultAgentModel: Schema.NullOr(ModelReference).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
});

export const UserPreferenceValues = Schema.Struct({
  ai: AIPreferences.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ defaultAgentModel: null })),
  ),
  interfaceScale: InterfaceScale.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  window: Schema.NullOr(WindowState).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
});

export type UserPreferenceValues = typeof UserPreferenceValues.Type;
