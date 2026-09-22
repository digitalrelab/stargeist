import { EventEmitter } from "node:events";
import { ipcMain, type UtilityProcess, type WebContents } from "electron";
import { Deferred, Effect } from "effect";
import { expect, it, vi } from "vite-plus/test";
import { connectRenderer } from "./renderer";
import { servePort } from "./port";

vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events");
  class Port extends EventEmitter {
    postMessage() {}
    start() {}
    close() {}
  }
  return {
    ipcMain: new EventEmitter(),
    MessageChannelMain: class {
      port1 = new Port();
      port2 = new Port();
    },
  };
});

it("releases host handlers on renderer navigation even when local port close emits no event", async () => {
  const postMessage = vi.fn();
  const child = { pid: 42, postMessage } as unknown as UtilityProcess;
  const contents = Object.assign(new EventEmitter(), {
    mainFrame: { postMessage: vi.fn() },
  }) as unknown as WebContents;
  await Effect.runPromise(
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const released = yield* Deferred.make<void>();
      yield* connectRenderer(
        child,
        contents,
        servePort(
          Deferred.succeed(started, undefined).pipe(
            Effect.andThen(Effect.never),
            Effect.ensuring(Deferred.succeed(released, undefined)),
          ),
        ),
      );
      ipcMain.emit(
        "stargeist:connect",
        { sender: contents, senderFrame: contents.mainFrame },
        "id",
      );
      yield* Deferred.await(started);
      contents.emit("did-start-navigation", { isMainFrame: true, isSameDocument: false });
      yield* Deferred.await(released).pipe(Effect.timeout("1 second"));
      expect(postMessage).toHaveBeenLastCalledWith({
        type: "disconnect",
        id: expect.any(String),
      });
    }).pipe(Effect.scoped),
  );
});
