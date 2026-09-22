import { Module } from "@stargeist/application";
import { Workspaces } from "@stargeist/domain";
import { makeWorkspaceStore } from "@stargeist/database/workspaces";
import { Effect, Layer } from "effect";
import { workspaceRoots } from "@stargeist/workspace-storage";
import { makeWorkspaces } from "./service";

const workspacesLayer = Layer.effect(
  Workspaces,
  Effect.gen(function* () {
    const store = yield* makeWorkspaceStore;
    return makeWorkspaces(workspaceRoots, store);
  }),
);

export const WorkspacesModule = Module.define({ exports: Workspaces, layer: workspacesLayer });
export { WorkspaceControlEndpoint, WorkspaceEndpoint } from "./backend";
