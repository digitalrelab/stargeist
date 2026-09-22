import * as RpcEndpoint from "@stargeist/application/rpc";
import { Workspaces } from "@stargeist/domain";
import { WorkspaceRpcs } from "@stargeist/protocol/workspaces";
import { Effect } from "effect";
import { WorkspaceControlRpcs } from "./control";
import { makeWorkspaceBrowser } from "./browser";

export const WorkspaceControlEndpoint = RpcEndpoint.define(WorkspaceControlRpcs)({
  concurrency: 1,
  implementation: Effect.gen(function* () {
    const workspaces = yield* Workspaces;
    return {
      "workspaces.open": ({ path }) => workspaces.open(path),
      "workspaces.initialize": ({ path }) => workspaces.initialize(path),
      "workspaces.reconnect": ({ id, path }) => workspaces.reconnect(id, path),
    };
  }),
});

export const WorkspaceEndpoint = RpcEndpoint.define(WorkspaceRpcs)({
  concurrency: 8,
  implementation: Effect.gen(function* () {
    const workspaces = yield* Workspaces;
    const browser = yield* makeWorkspaceBrowser(workspaces);
    return {
      "workspaces.list": () => workspaces.list,
      "workspaces.forget": ({ id }) => workspaces.forget(id),
      "workspaces.browse": ({ id }) => browser.browse(id),
      "workspaces.readDirectory": ({ listingId, offset }) => browser.read(listingId, offset),
      "workspaces.closeDirectory": ({ listingId }) => browser.close(listingId),
    };
  }),
});
