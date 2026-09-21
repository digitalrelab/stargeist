import { Effect, Schema } from "effect";

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

export const UserPreferenceValues = Schema.Struct({
  window: Schema.NullOr(WindowState).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
});

export type UserPreferenceValues = typeof UserPreferenceValues.Type;
