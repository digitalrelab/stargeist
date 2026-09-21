import { clientProtocol } from "@stargeist/std/rpc";
import { Cause, Effect, Redacted } from "effect";
import { expect, it } from "vite-plus/test";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { makeRpcAIProviderConnectionsClient } from "./rpc";

it("reports a closed host connection consistently for every provider operation", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const host = yield* clientProtocol({
        closed: Effect.never,
        send: () => {
          throw new Error("Private transport diagnostic");
        },
        listen: () => () => {},
        close: () => {},
      });
      const client = yield* makeRpcAIProviderConnectionsClient({ host });
      const operations = [
        client.configure({
          providerId: "example",
          credential: { kind: "apiKey", key: Redacted.make("secret") },
        }),
        client.list,
        client.check("example"),
        client.remove("example"),
      ];
      for (const operation of operations) {
        const error = yield* operation.pipe(Effect.flip);
        expect(error._tag).toBe("ClientUnavailableError");
        expect(failureMessage(Cause.fail(error))).toBe(
          "The connection is unavailable. Reopen Stargeist to reconnect.",
        );
        expect(canRetryFailure(Cause.fail(error))).toBe(false);
      }
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});
