import { createBrowserHistory, createHashHistory, createRouter } from "@tanstack/react-router";
import { reportFailure } from "@stargeist/std/errors";
import { Cause, Effect } from "effect";
import type { AtomRegistry } from "effect/unstable/reactivity";
import { RouteError } from "#src/shell/index.ts";
import { routeTree } from "../.generated/route-tree";
import type { RendererServices } from "./application";

export const createAppRouter = (
  application: RendererServices,
  registry: AtomRegistry.AtomRegistry,
) => {
  let history;

  if (window.location.protocol === "file:") {
    history = createHashHistory();
  } else {
    history = createBrowserHistory();
  }

  return createRouter({
    routeTree,
    context: { application, registry },
    history,
    defaultErrorComponent: RouteError,
    defaultOnCatch: (error) => Effect.runSync(reportFailure("renderer.route", Cause.die(error))),
  });
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
