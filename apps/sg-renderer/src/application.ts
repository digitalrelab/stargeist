import { Application } from "@stargeist/application";
import type { Effect, Layer } from "effect";
import type { DesktopConnection } from "#src/desktop/index.ts";
import type { ClientUnavailableError } from "#src/client/index.ts";
import { WorkspaceStateModule } from "#src/workspaces/desktop.ts";

export const createRendererApplication = (
  connection: Layer.Layer<DesktopConnection, ClientUnavailableError>,
) =>
  Application.define({
    modules: { workspaces: WorkspaceStateModule },
    provide: connection,
  });

export type RendererServices = Effect.Success<ReturnType<typeof createRendererApplication>["make"]>;
