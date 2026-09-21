import { reportFailure } from "@stargeist/std/errors";
import { clientProtocol, serverProtocol } from "@stargeist/std/rpc";
import { MessageChannelMain, type WebContents } from "electron";
import { Context, Effect, Layer } from "effect";
import { RpcClient, RpcServer } from "effect/unstable/rpc";
import { workspaceDialogHandlers } from "../workspaces/host";
import { libraryDialogHandlers } from "../libraries/host";
import { ControlRpcs, HostRpcs, type ControlClient } from "./rpc";
import { connectRenderer } from "./renderer";
import { connectPort, type NativePort } from "./port";
import { startBackendProcess } from "./process";

const serveDialogs = Effect.fnUntraced(
  function* (port: NativePort, contents: WebContents, client: ControlClient) {
    const connection = connectPort(port);
    const protocol = yield* serverProtocol(connection);

    yield* RpcServer.make(HostRpcs, { concurrency: 1 }).pipe(
      Effect.provide(workspaceDialogHandlers(contents, client)),
      Effect.provide(libraryDialogHandlers(contents, client)),
      Effect.provideService(RpcServer.Protocol, protocol),
      Effect.raceFirst(connection.closed),
    );
  },
  Effect.scoped,
  Effect.catchCause((cause) => reportFailure("desktop.connection", cause)),
);

export class Backend extends Context.Service<Backend>()("@stargeist/desktop/Backend", {
  make: Effect.gen(function* () {
    const { child, failure } = yield* startBackendProcess;
    const channel = new MessageChannelMain();
    const protocol = yield* clientProtocol(connectPort(channel.port1));
    const client = yield* RpcClient.make(ControlRpcs).pipe(
      Effect.provideService(RpcClient.Protocol, protocol),
    );

    child.postMessage({ type: "control", id: "host" }, [channel.port2]);

    return {
      failure,
      connect: (contents: WebContents) =>
        connectRenderer(child, contents, (port) => serveDialogs(port, contents, client)),
    };
  }),
}) {}

export const backendLayer = Layer.effect(Backend, Backend.make);
