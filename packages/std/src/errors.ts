import { Cause, Effect } from "effect";

export function reportFailure(operation: string, cause: Cause.Cause<unknown>) {
  return Cause.hasInterruptsOnly(cause)
    ? Effect.void
    : Effect.logError(cause).pipe(Effect.annotateLogs({ operation }));
}
