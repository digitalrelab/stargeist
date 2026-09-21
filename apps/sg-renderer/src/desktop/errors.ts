import { Effect } from "effect";
import type { RpcClientError } from "effect/unstable/rpc";
import { ClientUnavailableError } from "#src/client/index.ts";

export const connectionFailure = (cause: RpcClientError.RpcClientError) =>
  Effect.fail(
    new ClientUnavailableError({
      message: "The connection is unavailable. Reopen Stargeist to reconnect.",
      cause,
    }),
  );
