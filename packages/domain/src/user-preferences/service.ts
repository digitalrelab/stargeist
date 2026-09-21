import { Context, type Effect, Schema } from "effect";
import type { UserPreferenceValues } from "./values";

export class UserPreferencesError extends Schema.TaggedError<UserPreferencesError>()(
  "UserPreferencesError",
  {
    operation: Schema.Literals(["open", "read", "write"]),
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export class UserPreferences extends Context.Service<
  UserPreferences,
  {
    readonly get: <K extends keyof UserPreferenceValues>(
      key: K,
    ) => Effect.Effect<UserPreferenceValues[K], UserPreferencesError>;
    readonly set: <K extends keyof UserPreferenceValues>(
      key: K,
      value: UserPreferenceValues[K],
    ) => Effect.Effect<void, UserPreferencesError>;
  }
>()("@stargeist/domain/UserPreferences") {}
