import { serverProtocol } from "@stargeist/std/rpc";
import { Effect, Layer } from "effect";
import { RpcServer } from "effect/unstable/rpc";
import { libraryControlHandlers, libraryHandlers } from "../libraries/backend";
import { workspaceControlHandlers, workspaceHandlers } from "../workspaces/backend";
import { connectPort, type NativePort } from "./port";
import { ControlRpcs, RendererRpcs } from "./rpc";

export const backendHandlers = {
  control: Layer.merge(workspaceControlHandlers, libraryControlHandlers),
  renderer: Layer.merge(workspaceHandlers, libraryHandlers),
};

const control = Effect.fnUntraced(function* (port: NativePort) {
  const connection = connectPort(port);
  const protocol = yield* serverProtocol(connection);

  yield* RpcServer.make(ControlRpcs).pipe(
    Effect.provide(backendHandlers.control),
    Effect.provideService(RpcServer.Protocol, protocol),
    Effect.raceFirst(connection.closed),
  );
}, Effect.scoped);

const renderer = Effect.fnUntraced(function* (port: NativePort) {
  const connection = connectPort(port);
  const protocol = yield* serverProtocol(connection);

  yield* RpcServer.make(RendererRpcs, { concurrency: 8 }).pipe(
    Effect.provide(backendHandlers.renderer),
    Effect.provideService(RpcServer.Protocol, protocol),
    Effect.raceFirst(connection.closed),
  );
}, Effect.scoped);

export const backendServer = { control, renderer };
