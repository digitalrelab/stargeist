import { join } from "node:path";
import { Module } from "@stargeist/application";
import { UserPreferences } from "@stargeist/domain";
import { BrowserWindow } from "electron";
import { Context, Data, Deferred, Effect, Layer } from "effect";
import { Backend } from "../backend";
import { applicationIcon } from "../icon";
import { windowPlacement } from "./placement";
import { trackWindowState } from "./state";
import { scaleCommands, withInterfaceScale, type RunScaleCommand } from "./scale";
import { installWindowMenu } from "./menu";

class WindowLoadError extends Data.TaggedError("WindowLoadError")<{
  readonly cause: unknown;
}> {}

const openWindow = Effect.fnUntraced(function* (changeScale: RunScaleCommand) {
  const backend = yield* Backend;
  const preferences = yield* UserPreferences;
  const saved = yield* preferences.get("window");
  const scale = yield* preferences.get("interfaceScale");
  const { bounds, minWidth, minHeight } = windowPlacement(saved?.bounds ?? null);
  const window = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new BrowserWindow({
          ...bounds,
          minWidth,
          minHeight,
          title: "Stargeist",
          icon: applicationIcon(),
          backgroundColor: "#111113",
          show: false,
          autoHideMenuBar: true,
          webPreferences: {
            zoomFactor: scale,
            zoomMode: "isolated",
            preload: join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        }),
    ),
    (window) =>
      Effect.sync(() => {
        if (!window.isDestroyed()) window.destroy();
      }),
  );

  yield* Effect.sync(() => {
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.webContents.on("will-navigate", (event) => {
      if (event.url !== window.webContents.getURL()) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler((_webContents, _permission, respond) =>
      respond(false),
    );
    window.webContents.session.setPermissionCheckHandler(() => false);
  });

  const closed = yield* Deferred.make<void>();
  const onClosed = () => Effect.runSync(Deferred.succeed(closed, undefined));
  yield* Effect.acquireRelease(
    Effect.sync(() => window.once("closed", onClosed)),
    () => Effect.sync(() => window.removeListener("closed", onClosed)),
  );

  yield* Effect.gen(function* () {
    yield* backend.connect(window.webContents);
    yield* Effect.tryPromise({
      try: () => {
        if (MAIN_WINDOW_VITE_DEV_SERVER_URL) return window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
        return window.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
      },
      catch: (cause) => new WindowLoadError({ cause }),
    });

    yield* withInterfaceScale(
      window.webContents,
      changeScale,
      Effect.gen(function* () {
        yield* trackWindowState(
          window,
          {
            bounds,
            maximized: saved?.maximized ?? false,
            fullScreen: saved?.fullScreen ?? false,
          },
          saved,
        );
        yield* Effect.sync(() => {
          if (saved?.maximized) window.maximize();
          if (saved?.fullScreen) window.setFullScreen(true);
          window.show();
        });
        yield* Effect.never;
      }),
    );
  }).pipe(Effect.raceFirst(Deferred.await(closed)));
}, Effect.scoped);

class Windows extends Context.Service<Windows>()("@stargeist/desktop/Windows", {
  make: Effect.gen(function* () {
    const backend = yield* Backend;
    const preferences = yield* UserPreferences;
    const changeScale = yield* scaleCommands;
    yield* installWindowMenu(changeScale);
    return {
      open: openWindow(changeScale).pipe(
        Effect.provideService(Backend, backend),
        Effect.provideService(UserPreferences, preferences),
      ),
    };
  }),
}) {}

export const WindowsModule = Module.define({
  exports: Windows,
  layer: Layer.effect(Windows, Windows.make),
});
