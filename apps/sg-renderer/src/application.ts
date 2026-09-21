import { Application } from "@stargeist/application";
import type { Effect, Layer } from "effect";
import type { DesktopConnection } from "#src/desktop/index.ts";
import type { ClientUnavailableError } from "#src/rpc/index.ts";
import { LibrariesModule } from "#src/libraries/desktop.ts";
import { WorkspacesModule } from "#src/workspaces/desktop.ts";

export const createRendererApplication = (
  connection: Layer.Layer<DesktopConnection, ClientUnavailableError>,
) =>
  Application.define({
    modules: { workspaces: WorkspacesModule, libraries: LibrariesModule },
    provide: connection,
  });

export type RendererServices = Effect.Success<ReturnType<typeof createRendererApplication>["make"]>;
