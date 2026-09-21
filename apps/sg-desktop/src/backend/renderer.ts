import { randomUUID } from "node:crypto";
import { ipcMain, MessageChannelMain, type UtilityProcess, type WebContents } from "electron";
import { Effect, FiberSet } from "effect";
import type { NativePort } from "./port";

export const connectRenderer = (
  child: UtilityProcess,
  contents: WebContents,
  serveHost: (port: NativePort) => Effect.Effect<void>,
) =>
  Effect.gen(function* () {
    const run = yield* FiberSet.makeRuntime();

    let current: { readonly id: string; readonly close: () => void } | undefined;

    const disconnect = () => {
      if (!current) return;

      current.close();

      if (child.pid !== undefined) {
        child.postMessage({ type: "disconnect", id: current.id });
      }

      current = undefined;
    };

    const navigate = (event: Electron.Event<Electron.WebContentsDidStartNavigationEventParams>) => {
      if (event.isMainFrame && !event.isSameDocument) disconnect();
    };

    const request = (event: Electron.IpcMainEvent, nonce: unknown) => {
      if (event.sender !== contents || event.senderFrame !== contents.mainFrame) return;

      if (typeof nonce !== "string" || nonce.length > 64) return;

      disconnect();

      const id = randomUUID();
      const backendChannel = new MessageChannelMain();
      const hostChannel = new MessageChannelMain();

      current = { id, close: () => hostChannel.port1.close() };
      run(serveHost(hostChannel.port1));

      child.postMessage({ type: "renderer", id }, [backendChannel.port2]);
      event.senderFrame.postMessage("stargeist:ports", nonce, [
        backendChannel.port1,
        hostChannel.port2,
      ]);
    };

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        ipcMain.on("stargeist:connect", request);
        contents.on("render-process-gone", disconnect);
        contents.on("did-start-navigation", navigate);
        contents.on("destroyed", disconnect);
      }),
      () =>
        Effect.sync(() => {
          ipcMain.removeListener("stargeist:connect", request);
          contents.removeListener("render-process-gone", disconnect);
          contents.removeListener("did-start-navigation", navigate);
          contents.removeListener("destroyed", disconnect);
          disconnect();
        }),
    );
  });
