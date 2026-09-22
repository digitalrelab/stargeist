import { reportFailure } from "@stargeist/std/errors";
import { Deferred, Effect, Fiber, FiberSet, Layer } from "effect";
import { TemporaryStorage, pathsLayer, temporaryStorageLayer } from "../storage";
import { BackendApplication } from "./application";
import { backendIpc } from "./ipc";

const profile = process.argv[2];

if (!profile || !process.parentPort) {
  throw new Error("The backend must be started by the desktop host");
}

const parent = process.parentPort;

const program = Effect.gen(function* () {
  const stop = yield* Deferred.make<void>();
  const run = yield* FiberSet.makeRuntime<
    TemporaryStorage | Layer.Success<typeof BackendApplication.layer>
  >();

  const sessions = new Map<string, Fiber.Fiber<unknown, unknown>>();

  const receive = (event: Electron.MessageEvent) => {
    const data: unknown = event.data;

    if (!data || typeof data !== "object" || !("type" in data)) return;

    if (data.type === "stop") {
      Effect.runSync(Deferred.succeed(stop, undefined));
      return;
    }

    if (!("id" in data) || typeof data.id !== "string") return;

    const id = data.id;

    if (data.type === "disconnect") {
      const fiber = sessions.get(id);

      if (fiber) run(Fiber.interrupt(fiber));

      return;
    }

    if (data.type !== "control" && data.type !== "renderer") return;

    const port = event.ports[0];

    if (!port) return;

    const task = backendIpc[data.type](port);
    const fiber = run(
      task.pipe(
        Effect.catchCause((cause) => reportFailure("backend.connection", cause)),
        Effect.ensuring(
          Effect.sync(() => {
            sessions.delete(id);
          }),
        ),
      ),
    );

    sessions.set(id, fiber);
  };

  yield* Effect.acquireRelease(
    Effect.sync(() => parent.on("message", receive)),
    () =>
      Effect.sync(() => {
        parent.removeListener("message", receive);
      }),
  );

  parent.postMessage({ type: "ready" });
  yield* Deferred.await(stop);
}).pipe(
  Effect.scoped,
  Effect.provide(BackendApplication.layer),
  Effect.provide(temporaryStorageLayer.pipe(Layer.provideMerge(pathsLayer(profile)))),
);

Effect.runFork(
  program.pipe(
    Effect.matchCauseEffect({
      onFailure: (cause) =>
        reportFailure("backend.startup", cause).pipe(
          Effect.andThen(Effect.sync(() => process.exit(1))),
        ),
      onSuccess: () => Effect.sync(() => process.exit(0)),
    }),
  ),
);
