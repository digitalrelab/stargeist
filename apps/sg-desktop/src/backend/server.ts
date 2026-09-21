import { Libraries } from "@stargeist/domain/libraries/service";
import { Workspaces } from "@stargeist/domain/workspaces/service";
import { serverProtocol } from "@stargeist/std/rpc";
import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { libraryControlHandlers, libraryHandlers } from "../libraries/backend";
import { workspaceControlHandlers, workspaceHandlers } from "../workspaces/backend";
import type { BackendServices } from "./application";
import { connectPort, type NativePort } from "./port";
import { ControlRpcs, RendererRpcs } from "./rpc";

export const backendHandlers = (backend: BackendServices) => {
  const services = Layer.mergeAll(
    Layer.succeed(Workspaces, backend.workspaces),
    Layer.succeed(Libraries, backend.libraries),
  );

  return {
    control: Layer.merge(workspaceControlHandlers, libraryControlHandlers).pipe(
      Layer.provide(services),
    ),
    renderer: Layer.merge(workspaceHandlers, libraryHandlers).pipe(Layer.provide(services)),
  };
};

export const makeBackendServer = (backend: BackendServices) => {
  const handlers = backendHandlers(backend);

  const control = (port: NativePort) =>
    Effect.gen(function* () {
      const connection = connectPort(port);
      const protocol = yield* serverProtocol(connection);

      yield* RpcServer.make(ControlRpcs).pipe(
        Effect.provide(handlers.control),
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.raceFirst(connection.closed),
      );
    }).pipe(Effect.scoped);

  const renderer = (port: NativePort) =>
    Effect.gen(function* () {
      const connection = connectPort(port);
      const protocol = yield* serverProtocol(connection);

      yield* RpcServer.make(RendererRpcs, { concurrency: 8 }).pipe(
        Effect.provide(handlers.renderer),
        Effect.provideService(RpcServer.Protocol, protocol),
        Effect.raceFirst(connection.closed),
      );
    }).pipe(Effect.scoped);

  return { control, renderer };
};
