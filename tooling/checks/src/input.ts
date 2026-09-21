import { Effect, Schema } from "effect";
import { platforms } from "./plan.ts";

export class ChecksError extends Schema.TaggedError<ChecksError>()("ChecksError", {
  message: Schema.String,
}) {}

export const Platform = Schema.Literals(platforms);

export const PushUpdate = Schema.Tuple([
  Schema.NonEmptyString,
  Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)),
  Schema.NonEmptyString,
  Schema.String.check(Schema.isPattern(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/)),
]);

export function decode<S extends Schema.Constraint>(schema: S, value: unknown, label: string) {
  return Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError((error) => new ChecksError({ message: `${label}: ${error.message}` })),
  );
}
