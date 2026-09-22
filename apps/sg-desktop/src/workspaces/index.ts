import { Module } from "@stargeist/application";
import { Workspaces } from "@stargeist/domain";
import { openWorkspaceStore } from "@stargeist/database/workspaces";
import { Effect, Layer } from "effect";
import { StoragePaths } from "../storage";
import { workspaceRoots } from "./roots";
import { makeWorkspaces } from "./service";

const workspacesLayer = Layer.effect(
  Workspaces,
  Effect.gen(function* () {
    const paths = yield* StoragePaths;
    const store = yield* openWorkspaceStore(paths.database);
    return makeWorkspaces(workspaceRoots, store);
  }),
);

export const WorkspacesModule = Module.define({ exports: Workspaces, layer: workspacesLayer });
export { WorkspaceControlEndpoint, WorkspaceEndpoint } from "./backend";
