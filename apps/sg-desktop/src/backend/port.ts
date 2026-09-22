import { serverProtocol, type Connection } from "@stargeist/std/rpc";
import { Deferred, Effect } from "effect";
import { RpcServer } from "effect/unstable/rpc";

export interface NativePort {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  removeListener(event: "message", listener: (event: { data: unknown }) => void): unknown;
  removeListener(event: "close", listener: () => void): unknown;
  start(): void;
  close(): void;
}

export const connectPort = (port: NativePort): Connection => {
  const closed = Deferred.makeUnsafe<void>();
  return {
    send: (message) => port.postMessage(message),
    close: () => {
      if (Deferred.doneUnsafe(closed, Effect.void)) port.close();
    },
    closed: Deferred.await(closed),
    listen: (message, onClose) => {
      if (Deferred.isDoneUnsafe(closed)) {
        onClose();
        return () => {};
      }
      const receive = (event: { data: unknown }) => message(event.data);
      const close = () => {
        Deferred.doneUnsafe(closed, Effect.void);
        onClose();
      };
      port.on("message", receive);
      port.on("close", close);
      port.start();

      return () => {
        port.removeListener("message", receive);
        port.removeListener("close", close);
      };
    },
  };
};

export const servePort = <E, R>(program: Effect.Effect<void, E, R>) =>
  Effect.fnUntraced(function* (port: NativePort) {
    const connection = connectPort(port);
    const protocol = yield* serverProtocol(connection);
    yield* program.pipe(
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.raceFirst(connection.closed),
    );
  }, Effect.scoped);
