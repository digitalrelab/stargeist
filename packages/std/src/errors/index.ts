import { Cause, Effect } from "effect";

export function reportFailure(operation: string, cause: Cause.Cause<unknown>) {
  if (Cause.hasInterruptsOnly(cause)) return Effect.void;
  return Effect.logError(cause).pipe(Effect.annotateLogs({ operation }));
}
