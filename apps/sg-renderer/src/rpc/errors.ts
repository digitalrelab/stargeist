import { Cause, Data } from "effect";
import { RpcClientError } from "effect/unstable/rpc";

export class ClientUnavailableError extends Data.TaggedError("ClientUnavailableError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export const canRetryFailure = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);
  return !(
    error instanceof ClientUnavailableError || error instanceof RpcClientError.RpcClientError
  );
};

export const failureMessage = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  if (error instanceof RpcClientError.RpcClientError) {
    return "The connection is unavailable. Reopen Stargeist to reconnect.";
  }

  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
};
