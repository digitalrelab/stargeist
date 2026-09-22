import { clientProtocol } from "@stargeist/std/rpc";
import { Cause, Effect, Redacted } from "effect";
import { expect, it } from "vite-plus/test";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { makeRpcAgentModelsClient, makeRpcAIProviderConnectionsClient } from "./rpc";

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
      const models = yield* makeRpcAgentModelsClient({ host });
      const operations: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        client.configure({
          providerId: "example",
          configuration: Redacted.make({ key: "secret" }),
        }),
        client.list,
        client.check("example"),
        client.remove("example"),
        models.list,
        models.getDefault,
        models.setDefault({ providerId: "openrouter", modelId: "publisher/model" }),
      ];
      for (const operation of operations) {
        const error = yield* operation.pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "ClientUnavailableError" });
        expect(failureMessage(Cause.fail(error))).toBe(
          "The connection is unavailable. Reopen Stargeist to reconnect.",
        );
        expect(canRetryFailure(Cause.fail(error))).toBe(false);
      }
    }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
  );
});
