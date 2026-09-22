import { reportFailure } from "@stargeist/std/errors";
import { Deferred, Effect, FiberMap, Layer } from "effect";
import { TemporaryStorage, AppStorage, temporaryStorageLayer } from "@stargeist/storage";
import { BackendApplication } from "./application";
import { backendIpc } from "./ipc";

const profile = process.argv[2];

if (!profile || !process.parentPort) {
  throw new Error("The backend must be started by the desktop host");
}

const parent = process.parentPort;

const program = Effect.gen(function* () {
  const stop = yield* Deferred.make<void>();
  const sessions = yield* FiberMap.make<string>();
  const run = yield* FiberMap.runtime(sessions)<
    TemporaryStorage | Layer.Success<typeof BackendApplication.layer>
  >();

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
      const fiber = FiberMap.getUnsafe(sessions, id);
      if (fiber._tag === "Some") fiber.value.interruptUnsafe();

      return;
    }

    if (data.type !== "control" && data.type !== "renderer") return;

    const port = event.ports[0];

    if (!port) return;

    run(
      id,
      backendIpc[data.type](port).pipe(
        Effect.catchCause((cause) => reportFailure("backend.connection", cause)),
      ),
    );
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
  Effect.provide(temporaryStorageLayer.pipe(Layer.provideMerge(AppStorage.layer(profile)))),
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
