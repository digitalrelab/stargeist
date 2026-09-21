import { join } from "node:path";
import { Module } from "@stargeist/application";
import { BrowserWindow } from "electron";
import { Context, Data, Effect, Layer } from "effect";
import { Backend } from "./backend";

class WindowLoadError extends Data.TaggedError("WindowLoadError")<{
  readonly cause: unknown;
}> {}

const openWindow = Effect.gen(function* () {
  const backend = yield* Backend;
  const window = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const window = new BrowserWindow({
        width: 1100,
        height: 760,
        minWidth: 360,
        minHeight: 420,
        title: "Stargeist",
        backgroundColor: "#111113",
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, "preload.js"),
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event) => {
        if (event.url !== window.webContents.getURL()) event.preventDefault();
      });
      window.webContents.session.setPermissionRequestHandler((_webContents, _permission, respond) =>
        respond(false),
      );
      window.webContents.session.setPermissionCheckHandler(() => false);

      return window;
    }),
    (window) =>
      Effect.sync(() => {
        if (!window.isDestroyed()) window.destroy();
      }),
  );

  yield* backend.connect(window.webContents);

  yield* Effect.tryPromise({
    try: () =>
      MAIN_WINDOW_VITE_DEV_SERVER_URL
        ? window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
        : window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)),
    catch: (cause) => new WindowLoadError({ cause }),
  });

  yield* Effect.sync(() => window.show());
  yield* Effect.callback<void>((resume) => {
    const onClosed = () => resume(Effect.void);
    window.once("closed", onClosed);
    return Effect.sync(() => {
      window.removeListener("closed", onClosed);
    });
  });
}).pipe(Effect.scoped);

class Windows extends Context.Service<Windows>()("@stargeist/desktop/Windows", {
  make: Effect.map(Backend, (backend) => ({
    open: openWindow.pipe(Effect.provideService(Backend, backend)),
  })),
}) {}

export const WindowsModule = Module.define({
  exports: Windows,
  layer: Layer.effect(Windows, Windows.make),
});
