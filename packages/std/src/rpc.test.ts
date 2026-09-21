import { MessageChannel, type MessagePort } from "node:worker_threads";
import { Deferred, Effect, Exit, Fiber, Schema } from "effect";
import { Rpc, RpcClient, RpcGroup, RpcServer } from "effect/unstable/rpc";
import { describe, expect, it } from "vite-plus/test";
import { clientProtocol, serverProtocol, type Connection } from "./rpc";

const connect = (port: MessagePort): Connection => ({
  send: (message) => port.postMessage(message),
  close: () => port.close(),
  closed: Effect.callback<void>((resume) => {
    const close = () => resume(Effect.void);
    port.on("close", close);
    return Effect.sync(() => {
      port.off("close", close);
    });
  }),
  listen: (receive, close) => {
    port.on("message", receive);
    port.on("close", close);
    return () => {
      port.off("message", receive);
      port.off("close", close);
    };
  },
});

class Rejected extends Schema.Error<Rejected>("Rejected")({
  _tag: Schema.tag("Rejected"),
  message: Schema.String,
}) {}
const Contract = RpcGroup.make(
  Rpc.make("echo", { payload: { text: Schema.String }, success: Schema.String }),
  Rpc.make("reject", { error: Rejected }),
  Rpc.make("wait", { success: Schema.Void }),
);

const fixture = ({
  beforeReceive = Effect.void,
  sendResponse,
}: {
  beforeReceive?: Effect.Effect<void>;
  sendResponse?: Connection["send"];
} = {}) =>
  Effect.gen(function* () {
    const { port1, port2 } = yield* Effect.acquireRelease(
      Effect.sync(() => new MessageChannel()),
      (ports) =>
        Effect.sync(() => {
          ports.port1.close();
          ports.port2.close();
        }),
    );
    const started = yield* Deferred.make<void>();
    const released = yield* Deferred.make<void>();
    const server = connect(port1);
    const protocol = yield* serverProtocol({ ...server, send: sendResponse ?? server.send });
    yield* RpcServer.make(Contract).pipe(
      Effect.provide(
        Contract.toLayer({
          echo: ({ text }) => Effect.succeed(text),
          reject: () => Effect.fail(new Rejected({ message: "Expected rejection" })),
          wait: () =>
            Deferred.succeed(started, undefined).pipe(
              Effect.andThen(Effect.never),
              Effect.ensuring(Deferred.succeed(released, undefined)),
            ),
        }),
      ),
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.raceFirst(server.closed),
      Effect.forkScoped,
    );
    const clientSide = connect(port2);
    const received = yield* Deferred.make<void>();
    const clientTransport = yield* clientProtocol({
      ...clientSide,
      listen: (receive, close) =>
        clientSide.listen((message) => {
          receive(message);
          Effect.runSync(Deferred.succeed(received, undefined));
        }, close),
    });
    const client = yield* RpcClient.make(Contract).pipe(
      Effect.provideService(RpcClient.Protocol, {
        ...clientTransport,
        run: (id, receive) => beforeReceive.pipe(Effect.andThen(clientTransport.run(id, receive))),
      }),
    );
    return {
      client,
      started,
      released,
      received,
      disconnect: () => port1.close(),
      sendRaw: (message: unknown) => port1.postMessage(message),
    };
  });

describe("RPC message connections", () => {
  it("disconnects callers when the server cannot send a response", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { client, started, released } = yield* fixture({
          sendResponse: () => {
            throw new Error("Response serialization failed");
          },
        });
        const pending = yield* client.wait().pipe(Effect.result, Effect.forkChild);
        yield* Deferred.await(started);

        const result = yield* Effect.result(client.echo({ text: "unavailable response" }));

        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "RpcClientError" },
        });
        expect(yield* Fiber.join(pending)).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "RpcClientError" },
        });
        yield* Deferred.await(released);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("retains send failures for the current and subsequent requests", async () => {
    const cause = new Error("Message serialization failed");

    await Effect.runPromise(
      Effect.gen(function* () {
        const protocol = yield* clientProtocol({
          closed: Effect.never,
          send: () => {
            throw cause;
          },
          listen: () => () => {},
          close: () => {},
        });
        const client = yield* RpcClient.make(Contract).pipe(
          Effect.provideService(RpcClient.Protocol, protocol),
        );

        for (const text of ["first", "after failure"]) {
          const result = yield* Effect.result(client.echo({ text }));
          expect(result).toMatchObject({
            _tag: "Failure",
            failure: { _tag: "RpcClientError", reason: { cause } },
          });
        }
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("retains malformed-response diagnostics and releases pending backend work", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { client, started, released, sendRaw } = yield* fixture();
        const pending = yield* client.wait().pipe(Effect.result, Effect.forkChild);
        yield* Deferred.await(started);
        sendRaw({ _tag: "InvalidResponse" });

        expect(yield* Fiber.join(pending)).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "RpcClientError", reason: { cause: expect.any(Schema.SchemaError) } },
        });
        yield* Deferred.await(released);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("round-trips schema-defined values and declared errors", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { client } = yield* fixture();
        expect(yield* client.echo({ text: "héllo — workspace" })).toBe("héllo — workspace");
        expect(yield* Effect.exit(client.reject())).toEqual(
          Exit.fail(new Rejected({ message: "Expected rejection" })),
        );
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("preserves responses that arrive before the client receive loop starts", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const ready = yield* Deferred.make<void>();
        const { client, received } = yield* fixture({ beforeReceive: Deferred.await(ready) });
        const request = yield* client.echo({ text: "first request" }).pipe(Effect.forkChild);
        yield* Deferred.await(received);
        yield* Deferred.succeed(ready, undefined);
        expect(yield* Fiber.join(request)).toBe("first request");
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("interrupts backend work when its caller cancels", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { client, started, released } = yield* fixture();
        const pending = yield* client.wait().pipe(Effect.forkChild);
        yield* Deferred.await(started);
        yield* Fiber.interrupt(pending);
        yield* Deferred.await(released);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });

  it("fails pending requests and releases backend work on disconnect", async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        const { client, started, released, disconnect } = yield* fixture();
        const pending = yield* client.wait().pipe(Effect.exit, Effect.forkChild);
        yield* Deferred.await(started);
        disconnect();
        const result = yield* Fiber.join(pending);
        expect(Exit.isFailure(result)).toBe(true);
        yield* Deferred.await(released);
      }).pipe(Effect.scoped, Effect.timeout("3 seconds")),
    );
  });
});
