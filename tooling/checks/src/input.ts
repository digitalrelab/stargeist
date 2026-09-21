import { Effect, Schema } from "effect";
import { platforms } from "./plan.ts";

export class ChecksError extends Schema.TaggedError<ChecksError>()("ChecksError", {
  message: Schema.String,
}) {}

export const Platform = Schema.Literals(platforms);

export const PlanReference = Schema.Struct({
  version: Schema.Literal(1),
  base: Schema.NullOr(Schema.NonEmptyString),
  head: Schema.NonEmptyString,
  workingTree: Schema.Boolean,
  digest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});

const JobResult = Schema.Struct({
  result: Schema.Literals(["success", "failure", "cancelled", "skipped"]),
  outputs: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
});

export const JobResults = Schema.Struct({
  prepare: JobResult,
  targets: JobResult,
}).annotate({ parseOptions: { onExcessProperty: "error" } });

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

export function attempt<A>(operation: () => A) {
  return Effect.try({
    try: operation,
    catch: (error) => {
      if (error instanceof ChecksError) {
        return error;
      }

      if (error instanceof Error) {
        return new ChecksError({ message: error.message });
      }

      return new ChecksError({ message: String(error) });
    },
  });
}
