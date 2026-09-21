import { Effect, Layer } from "effect";
import { ClientUnavailableError } from "#src/rpc/index.ts";
import { WorkspacesClient } from "#src/workspaces/client.ts";

export const workspacesLayer = Layer.effect(
  WorkspacesClient,
  Effect.fail(
    new ClientUnavailableError({ message: "Workspaces are not implemented in the web app yet." }),
  ),
);
