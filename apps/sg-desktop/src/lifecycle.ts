import type { Application } from "@stargeist/application";
import { reportFailure } from "@stargeist/std/errors";
import { app, BrowserWindow } from "electron";
import { Cause, Deferred, Effect, FiberSet } from "effect";

interface DesktopServices {
  readonly windows: { readonly open: Effect.Effect<void, unknown> };
  readonly backend: { readonly failure: Effect.Effect<never, unknown> };
}

export const runDesktop = (application: Application.Application<DesktopServices, unknown>) =>
  Effect.gen(function* () {
    const shutdown = yield* Deferred.make<void>();
    const completion = yield* Deferred.make<void, unknown>();
    const fail = (cause: Cause.Cause<unknown>) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.void
        : Deferred.failCause(completion, cause).pipe(
            Effect.andThen(Deferred.succeed(shutdown, undefined)),
          );

    yield* Effect.gen(function* () {
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

      const running = Effect.gen(function* () {
        yield* Effect.promise(() => app.whenReady());

        const desktop = yield* application.make;
        const runWindow = yield* FiberSet.makeRuntime();

        const launchWindow = () => {
          runWindow(desktop.windows.open.pipe(Effect.onError(fail)));
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

        yield* desktop.backend.failure;
      });

      yield* running.pipe(Effect.onError(fail), Effect.raceFirst(Deferred.await(shutdown)));
    }).pipe(Effect.scoped, Effect.catchCause(fail));

    yield* Deferred.succeed(completion, undefined);
    yield* Deferred.await(completion);
  }).pipe(
    Effect.matchCauseEffect({
      onFailure: (cause) =>
        reportFailure("desktop.application", cause).pipe(
          Effect.andThen(Effect.sync(() => app.exit(1))),
        ),
      onSuccess: () => Effect.sync(() => app.quit()),
    }),
  );
