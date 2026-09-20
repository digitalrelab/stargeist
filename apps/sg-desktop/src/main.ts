import { reportFailure } from "@stargeist/std/errors";
import { app, BrowserWindow } from "electron";
import squirrelStartup from "electron-squirrel-startup";
import { Cause, Effect } from "effect";
import { configureDevelopmentProfile } from "./development-profile";
import { openWindow } from "./window";

const fail = (operation: string) =>
  Effect.catchCause((cause) =>
    Cause.hasInterruptsOnly(cause)
      ? Effect.failCause(cause)
      : reportFailure(operation, cause).pipe(Effect.andThen(Effect.sync(() => app.exit(1)))),
  );

const program = Effect.gen(function* () {
  yield* configureDevelopmentProfile;
  yield* Effect.promise(() => app.whenReady());
  const scope = yield* Effect.scope;
  const launchWindow = () => {
    Effect.runFork(openWindow.pipe(fail("desktop.window"), Effect.forkIn(scope)));
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

  yield* Effect.callback<void>((resume) => {
    const quit = () => resume(Effect.void);
    app.once("before-quit", quit);
    return Effect.sync(() => {
      app.removeListener("before-quit", quit);
    });
  });
}).pipe(Effect.scoped, fail("desktop.startup"));

if (squirrelStartup) {
  app.quit();
} else {
  Effect.runFork(program);
}
