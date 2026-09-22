import { app, BrowserWindow } from "electron";
import { Cause, Deferred, Effect, Exit, FiberSet, Scope } from "effect";

export const runWindows = Effect.fnUntraced(function* (open: Effect.Effect<void, unknown>) {
  const failure = yield* Deferred.make<never, unknown>();
  const failed = (cause: Cause.Cause<unknown>) => {
    if (Cause.hasInterruptsOnly(cause)) return Effect.void;
    return Deferred.failCause(failure, cause);
  };
  yield* Scope.addFinalizerExit(yield* Effect.scope, (exit) => {
    if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) return Effect.void;
    return Effect.gen(function* () {
      if (yield* Deferred.isDone(failure)) yield* Deferred.await(failure).pipe(Effect.orDie);
    });
  });
  yield* Effect.gen(function* () {
    const run = yield* FiberSet.makeRuntime();
    const launch = () => {
      run(open.pipe(Effect.onError(failed)));
    };
    const activate = () => {
      if (BrowserWindow.getAllWindows().length === 0) launch();
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
    launch();
    yield* Deferred.await(failure);
  }).pipe(Effect.scoped);
});
