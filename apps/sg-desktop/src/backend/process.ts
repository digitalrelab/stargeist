import { join } from "node:path";
import { utilityProcess } from "electron";
import { Data, Deferred, Effect } from "effect";
import { StoragePaths } from "../storage";

class BackendError extends Data.TaggedError("BackendError")<{ readonly message: string }> {}

export const startBackendProcess = Effect.gen(function* () {
  const { profile } = yield* StoragePaths;
  const exited = yield* Deferred.make<number>();
  const onExit = (code: number) => Effect.runSync(Deferred.succeed(exited, code));

  const child = yield* Effect.acquireRelease(
    Effect.sync(() => {
      const child = utilityProcess.fork(join(__dirname, "backend.js"), [profile], {
        serviceName: "Stargeist backend",
      });

      child.once("exit", onExit);

      return child;
    }),
    (child) =>
      Effect.gen(function* () {
        if (yield* Deferred.isDone(exited)) return;

        yield* Effect.sync(() => child.postMessage({ type: "stop" }));

        yield* Deferred.await(exited).pipe(
          Effect.timeout("5 seconds"),
          Effect.catchTag("TimeoutError", () =>
            Effect.sync(() => child.kill()).pipe(
              Effect.andThen(Deferred.await(exited)),
              Effect.timeout("5 seconds"),
              Effect.orDie,
            ),
          ),
        );
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            child.removeListener("exit", onExit);
          }),
        ),
      ),
  );

  yield* Effect.callback<void, BackendError>((resume) => {
    const ready = (data: unknown) => {
      if (data && typeof data === "object" && "type" in data && data.type === "ready") {
        resume(Effect.void);
      }
    };

    child.on("message", ready);

    return Effect.sync(() => {
      child.removeListener("message", ready);
    });
  }).pipe(
    Effect.raceFirst(
      Deferred.await(exited).pipe(
        Effect.andThen(Effect.fail(new BackendError({ message: "The backend could not start." }))),
      ),
    ),
    Effect.timeout("15 seconds"),
  );

  const failure = Deferred.await(exited).pipe(
    Effect.andThen(Effect.fail(new BackendError({ message: "The backend stopped unexpectedly." }))),
  );

  return { child, failure };
});
