import { Application } from "@stargeist/application";
import { reportFailure } from "@stargeist/std/errors";
import { app } from "electron";
import { Effect, Layer } from "effect";
import { RpcClient, RpcServer } from "effect/unstable/rpc";
import { AgentModelsEndpoint, aiServicesLayer, ProviderConnectionsEndpoint } from "./ai";
import { openBackend, servePort } from "./backend";
import { folderPickerLayer } from "./filesystem/host";
import { pathsLayer } from "./storage";
import { WindowsModule, WindowConnections, runWindows } from "./window";
import { userPreferencesLayer } from "./user-preferences";
import { workspaceCommandsLayer, WorkspaceDialogsEndpoint } from "./workspaces/host";

const HostRpcs = WorkspaceDialogsEndpoint.rpcs
  .merge(ProviderConnectionsEndpoint.rpcs)
  .merge(AgentModelsEndpoint.rpcs);
const serveHost = RpcServer.make(HostRpcs, { concurrency: 1 }).pipe(
  Effect.provide(WorkspaceDialogsEndpoint.layer),
  Effect.provide(ProviderConnectionsEndpoint.layer),
  Effect.provide(AgentModelsEndpoint.layer),
  Effect.scoped,
);

export const DesktopApplication = Application.define({
  modules: { windows: WindowsModule },
});

export const desktopProgram = Effect.gen(function* () {
  const backend = yield* openBackend;
  const services = yield* Layer.build(
    aiServicesLayer.pipe(Layer.provideMerge(userPreferencesLayer)),
  );
  yield* Effect.all(
    [
      Effect.gen(function* () {
        const commands = yield* Layer.build(
          workspaceCommandsLayer.pipe(
            Layer.provide(Layer.succeed(RpcClient.Protocol, backend.protocol)),
          ),
        );
        const connections = WindowConnections.of({
          connect: (contents) =>
            backend.connect(
              contents,
              servePort(
                serveHost.pipe(
                  Effect.provide(folderPickerLayer(contents)),
                  Effect.provide(commands),
                  Effect.provide(services),
                  Effect.catchCause((cause) => reportFailure("desktop.connection", cause)),
                ),
              ),
            ),
        });
        const application = yield* DesktopApplication.make.pipe(
          Effect.provideService(WindowConnections, connections),
          Effect.provide(services),
        );
        yield* runWindows(application.windows.open);
      }),
      backend.failure,
    ],
    { concurrency: 2, discard: true },
  );
}).pipe(Effect.provide(Layer.unwrap(Effect.sync(() => pathsLayer(app.getPath("userData"))))));
