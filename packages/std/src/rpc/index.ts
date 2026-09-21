import { Effect, FiberSet, Queue, Schema } from "effect";
import {
  RpcClient,
  RpcClientError,
  RpcMessage,
  RpcSerialization,
  RpcServer,
} from "effect/unstable/rpc";
import { reportFailure } from "../errors";

export interface Connection {
  readonly closed: Effect.Effect<void>;
  readonly send: (message: unknown) => void;
  readonly listen: (message: (data: unknown) => void, closed: () => void) => () => void;
  readonly close: () => void;
}

const decode = Schema.decodeUnknownSync(RpcMessage.EncodedSchema);

const disconnected = (cause?: unknown) =>
  new RpcClientError.RpcClientError({
    reason: new RpcClientError.RpcClientDefect({
      message: "The connection closed.",
      cause,
    }),
  });

export const clientProtocol = (connection: Connection) =>
  RpcClient.Protocol.make(
    Effect.fn(function* (writeResponse, clientIds) {
      const serialization = yield* RpcSerialization.RpcSerialization;
      const run = yield* FiberSet.makeRuntime();
      const requests = new Map<string, number>();

      let failure: RpcClientError.RpcClientError | undefined;

      const close = (error = disconnected()) => {
        if (failure) {
          return;
        }

        failure = error;

        for (const id of new Set([...clientIds, ...requests.values()])) {
          run(writeResponse(id, { _tag: "ClientProtocolError", error }));
        }

        requests.clear();
        connection.close();
      };

      const receive = (data: unknown) => {
        if (failure) {
          return;
        }

        try {
          const message = decode(data);

          if (
            message._tag !== "Chunk" &&
            message._tag !== "Exit" &&
            message._tag !== "Defect" &&
            message._tag !== "Pong"
          ) {
            close(disconnected(new Error(`Unexpected server message: ${message._tag}`)));

            return;
          }

          let recipients: Iterable<number | undefined>;

          if ("requestId" in message) {
            recipients = [requests.get(String(message.requestId))];
          } else {
            recipients = new Set([...clientIds, ...requests.values()]);
          }

          if (message._tag === "Exit") {
            requests.delete(String(message.requestId));
          }

          if (message._tag === "Defect") {
            requests.clear();
          }

          for (const id of recipients) {
            if (id === undefined) {
              continue;
            }

            run(writeResponse(id, message as unknown as RpcMessage.FromServerEncoded));
          }
        } catch (cause) {
          close(disconnected(cause));
        }
      };

      yield* Effect.acquireRelease(
        Effect.sync(() => connection.listen(receive, () => close())),
        (remove) =>
          Effect.sync(() => {
            remove();
            connection.close();
          }),
      );

      return {
        send: (id, message) =>
          Effect.try({
            try: () => {
              if (failure) {
                throw failure;
              }

              if (message._tag === "Request") {
                requests.set(String(message.id), id);
              }

              if (message._tag === "Interrupt") {
                requests.delete(String(message.requestId));
              }

              connection.send(message);
            },
            catch: (cause) => {
              const error = failure ?? disconnected(cause);
              close(error);

              return error;
            },
          }),
        supportsAck: true,
        supportsTransferables: false,
        codecFor: serialization.codecFor,
      } satisfies Omit<RpcClient.Protocol["Service"], "run">;
    }),
  ).pipe(Effect.provide(RpcSerialization.layerSchemaBinary()));

export const serverProtocol = (connection: Connection) =>
  RpcServer.Protocol.make(
    Effect.fn(function* (writeRequest) {
      const serialization = yield* RpcSerialization.RpcSerialization;
      const disconnects = yield* Queue.make<number>();
      const run = yield* FiberSet.makeRuntime();

      let closed = false;

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        run(Queue.offer(disconnects, 0));
        connection.close();
      };

      const receive = (data: unknown) => {
        if (closed) {
          return;
        }

        try {
          const message = decode(data);

          if (
            message._tag !== "Request" &&
            message._tag !== "Ack" &&
            message._tag !== "Interrupt" &&
            message._tag !== "Ping" &&
            message._tag !== "Eof"
          ) {
            close();

            return;
          }

          run(writeRequest(0, message as unknown as RpcMessage.FromClientEncoded));
        } catch {
          close();
        }
      };

      yield* Effect.acquireRelease(
        Effect.sync(() => connection.listen(receive, close)),
        (remove) =>
          Effect.sync(() => {
            remove();
            connection.close();
          }),
      );

      return {
        disconnects,
        send: (_id, message) =>
          Effect.sync(() => {
            if (!closed) {
              connection.send(message);
            }
          }).pipe(
            Effect.catchCause((cause) =>
              reportFailure("rpc.server.send", cause).pipe(Effect.andThen(Effect.sync(close))),
            ),
          ),
        end: () => Effect.sync(close),
        clientIds: Effect.sync(() => {
          if (closed) {
            return new Set<number>();
          }

          return new Set([0]);
        }),
        initialMessage: Effect.succeedNone,
        supportsAck: true,
        supportsTransferables: false,
        supportsSpanPropagation: true,
        supportsNotifications: false,
        codecFor: serialization.codecFor,
      } satisfies Omit<RpcServer.Protocol["Service"], "run">;
    }),
  ).pipe(Effect.provide(RpcSerialization.layerSchemaBinary()));
