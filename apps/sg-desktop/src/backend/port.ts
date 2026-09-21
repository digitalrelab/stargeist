import type { Connection } from "@stargeist/std/rpc";
import { Effect } from "effect";

export interface NativePort {
  postMessage(message: unknown): void;
  on(event: "message", listener: (event: { data: unknown }) => void): unknown;
  on(event: "close", listener: () => void): unknown;
  removeListener(event: "message", listener: (event: { data: unknown }) => void): unknown;
  removeListener(event: "close", listener: () => void): unknown;
  start(): void;
  close(): void;
}

export const connectPort = (port: NativePort): Connection => ({
  send: (message) => port.postMessage(message),
  close: () => port.close(),
  closed: Effect.callback<void>((resume) => {
    const close = () => resume(Effect.void);
    port.on("close", close);

    return Effect.sync(() => {
      port.removeListener("close", close);
    });
  }),
  listen: (message, closed) => {
    const receive = (event: { data: unknown }) => message(event.data);
    port.on("message", receive);
    port.on("close", closed);
    port.start();

    return () => {
      port.removeListener("message", receive);
      port.removeListener("close", closed);
    };
  },
});
