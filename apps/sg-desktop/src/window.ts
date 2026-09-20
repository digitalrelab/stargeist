import { join } from "node:path";
import { BrowserWindow } from "electron";
import { Data, Effect } from "effect";

export class WindowLoadError extends Data.TaggedError("WindowLoadError")<{
  readonly cause: unknown;
}> {}

export const openWindow = Effect.gen(function* () {
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
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });

      window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      window.webContents.on("will-navigate", (event) => event.preventDefault());
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
