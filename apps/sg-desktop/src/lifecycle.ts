import { reportFailure } from "@stargeist/std/errors";
import { app } from "electron";
import { Cause, Deferred, Effect, type Scope } from "effect";
import { applicationIcon } from "./icon";

export const runDesktop = (program: Effect.Effect<void, unknown, Scope.Scope>) =>
  Effect.gen(function* () {
    const shutdown = yield* Deferred.make<void>();
    const completion = yield* Deferred.make<void, unknown>();
    const fail = (cause: Cause.Cause<unknown>) => {
      if (Cause.hasInterruptsOnly(cause)) return Effect.void;
      return Deferred.failCause(completion, cause).pipe(
        Effect.andThen(Deferred.succeed(shutdown, undefined)),
      );
    };
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
      yield* Effect.gen(function* () {
        yield* Effect.promise(() => app.whenReady());
        if (process.platform === "darwin" && !app.isPackaged) {
          yield* Effect.sync(() => app.dock?.setIcon(applicationIcon()));
        }
        yield* program;
      }).pipe(Effect.onError(fail), Effect.raceFirst(Deferred.await(shutdown)));
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
