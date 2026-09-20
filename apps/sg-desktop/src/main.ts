import { Application } from "@stargeist/application";
import { reportFailure } from "@stargeist/std/errors";
import { app, BrowserWindow } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { Deferred, Effect, FiberSet } from "effect";
import { configureDevelopmentProfile } from "./development-profile";
import { WindowsModule, type WindowLoadError } from "./window";

const Desktop = Application.define({ modules: { windows: WindowsModule } });

const program = Effect.gen(function* () {
  yield* configureDevelopmentProfile;
  yield* Effect.promise(() => app.whenReady());
  const shutdown = yield* Deferred.make<void, WindowLoadError>();
  const quit = (event: Electron.Event) => {
    event.preventDefault();
    Effect.runSync(Deferred.succeed(shutdown, undefined));
  };

  yield* Effect.acquireRelease(
    Effect.sync(() => {
      app.on("before-quit", quit);
    }),
    () =>
      Effect.sync(() => {
        app.removeListener("before-quit", quit);
      }),
  );

  const desktop = yield* Desktop.make;
  const runWindow = yield* FiberSet.makeRuntime();
  const launchWindow = () => {
    runWindow(
      desktop.windows.open.pipe(Effect.catchCause((cause) => Deferred.failCause(shutdown, cause))),
    );
  };
  const activate = () => {
    if (BrowserWindow.getAllWindows().length === 0) launchWindow();
  };
  const close = () => {
    if (process.platform !== "darwin") app.quit();
  };

  yield* Effect.acquireRelease(
    Effect.sync(() => {
      app.on("activate", activate);
      app.on("window-all-closed", close);
    }),
    () =>
      Effect.sync(() => {
        app.removeListener("activate", activate);
        app.removeListener("window-all-closed", close);
      }),
  );

  launchWindow();

  yield* Deferred.await(shutdown);
}).pipe(
  Effect.scoped,
  Effect.matchCauseEffect({
    onFailure: (cause) =>
      reportFailure("desktop.application", cause).pipe(
        Effect.andThen(Effect.sync(() => app.exit(1))),
      ),
    onSuccess: () => Effect.sync(() => app.quit()),
  }),
);

if (squirrelStartup) {
  app.quit();
} else {
  Effect.runFork(program);
}
