import { Workspaces } from "@stargeist/domain/workspaces/service";
import { reportFailure } from "@stargeist/std/errors";
import { serverProtocol } from "@stargeist/std/rpc";
import { Deferred, Effect, Fiber, FiberSet } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { AppDirectories, directoriesLayer } from "../storage";
import {
  WorkspaceRpcs,
  WorkspaceControlRpcs,
  workspaceHandlers,
  workspaceControlHandlers,
} from "../workspaces/backend";
import { BackendApplication } from "./application";
import { connectPort, type NativePort } from "./port";

const profile = process.argv[2];

if (!profile || !process.parentPort) {
  throw new Error("The backend must be started by the desktop host");
}

const parent = process.parentPort;

const program = Effect.gen(function* () {
  const backend = yield* BackendApplication.make;
  const stop = yield* Deferred.make<void>();
  const run = yield* FiberSet.makeRuntime<AppDirectories>();

  const sessions = new Map<string, Fiber.Fiber<unknown, unknown>>();

  const control = (port: NativePort) =>
    Effect.gen(function* () {
      const connection = connectPort(port);
      const protocol = yield* serverProtocol(connection);

      yield* RpcServer.make(WorkspaceControlRpcs).pipe(
        Effect.provide(workspaceControlHandlers),
        Effect.provideService(Workspaces, backend.workspaces),
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.raceFirst(connection.closed),
      );
    }).pipe(Effect.scoped);

  const renderer = (port: NativePort) =>
    Effect.gen(function* () {
      const connection = connectPort(port);
      const protocol = yield* serverProtocol(connection);

      yield* RpcServer.make(WorkspaceRpcs, { concurrency: 8 }).pipe(
        Effect.provide(workspaceHandlers),
        Effect.provideService(Workspaces, backend.workspaces),
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.raceFirst(connection.closed),
      );
    }).pipe(Effect.scoped);

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

    const task = data.type === "control" ? control(port) : renderer(port);
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
}).pipe(Effect.scoped, Effect.provide(directoriesLayer(profile)));

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
