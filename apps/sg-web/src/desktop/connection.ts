import { clientProtocol, type Connection } from "@stargeist/std/rpc";
import { Context, Effect, Layer } from "effect";
import { ClientUnavailableError } from "#src/rpc/index.ts";

const connect = Effect.callback<readonly [MessagePort, MessagePort]>((resume) => {
  const nonce = crypto.randomUUID();

  const receive = (event: MessageEvent<unknown>) => {
    if (event.source !== window || !event.data || typeof event.data !== "object") return;

    if (
      !("type" in event.data) ||
      event.data.type !== "stargeist:ports" ||
      !("nonce" in event.data) ||
      event.data.nonce !== nonce
    ) {
      return;
    }

    const [backend, host] = event.ports;

    if (backend && host) resume(Effect.succeed([backend, host] as const));
  };

  window.addEventListener("message", receive);
  window.postMessage({ type: "stargeist:connect", nonce }, "*");

  return Effect.sync(() => {
    window.removeEventListener("message", receive);
  });
}).pipe(
  Effect.timeout("10 seconds"),
  Effect.mapError(
    (cause) =>
      new ClientUnavailableError({
        message: "The connection could not start. Reopen Stargeist to reconnect.",
        cause,
      }),
  ),
);

const connection = (port: MessagePort): Connection => ({
  send: (message) => port.postMessage(message),
  close: () => port.close(),
  closed: Effect.callback<void>((resume) => {
    const close = () => resume(Effect.void);

    port.addEventListener("close", close);

    return Effect.sync(() => {
      port.removeEventListener("close", close);
    });
  }),
  listen: (message, closed) => {
    const receive = (event: MessageEvent<unknown>) => message(event.data);

    port.addEventListener("message", receive);
    port.addEventListener("close", closed);
    port.addEventListener("messageerror", closed);
    port.start();

    return () => {
      port.removeEventListener("message", receive);
      port.removeEventListener("close", closed);
      port.removeEventListener("messageerror", closed);
    };
  },
});

export class DesktopConnection extends Context.Service<DesktopConnection>()(
  "@stargeist/web/DesktopConnection",
  {
    make: Effect.gen(function* () {
      const ports = yield* Effect.acquireRelease(connect, (ports) =>
        Effect.sync(() => {
          for (const port of ports) port.close();
        }),
      );

      const backendProtocol = yield* clientProtocol(connection(ports[0]));
      const hostProtocol = yield* clientProtocol(connection(ports[1]));

      return { backend: backendProtocol, host: hostProtocol };
    }),
  },
) {}

export const desktopConnectionLayer = Layer.effect(DesktopConnection, DesktopConnection.make);
