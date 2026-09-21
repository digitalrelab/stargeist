import { Cause, Data } from "effect";

export class ClientUnavailableError extends Data.TaggedError("ClientUnavailableError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const canRetryFailure = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  return !(error instanceof ClientUnavailableError);
};

export const failureMessage = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
};
