import { EventEmitter } from "node:events";
import { Effect } from "effect";
import { expect, it } from "vite-plus/test";
import { servePort } from "./port";

it("releases a connection that closes while its protocol is starting", async () => {
  const port = Object.assign(new EventEmitter(), {
    postMessage: () => {},
    close: () => {
      port.emit("close");
    },
    start: () => {
      port.emit("close");
    },
  });

  await Effect.runPromise(servePort(Effect.never)(port).pipe(Effect.timeout("1 second")));

  expect(port.eventNames()).toEqual([]);
});
