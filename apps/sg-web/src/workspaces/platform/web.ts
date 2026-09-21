import { Effect, Layer } from "effect";
import { ClientUnavailableError } from "#src/rpc/index.ts";
import { WorkspacesClient } from "../client";

export const workspacesLayer = Layer.effect(
  WorkspacesClient,
  Effect.fail(
    new ClientUnavailableError({ message: "Workspaces are available in the desktop app." }),
  ),
);
