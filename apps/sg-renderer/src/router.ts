import { createBrowserHistory, createHashHistory, createRouter } from "@tanstack/react-router";
import { reportFailure } from "@stargeist/std/errors";
import { Cause, Effect } from "effect";
import { RouteError } from "#src/shell/index.ts";
import { routeTree } from "../.generated/route-tree";
import type { RendererServices } from "./application";

export const createAppRouter = (application: RendererServices) =>
  createRouter({
    routeTree,
    context: { application },
    history: window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory(),
    defaultErrorComponent: RouteError,
    defaultOnCatch: (error) => Effect.runSync(reportFailure("renderer.route", Cause.die(error))),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
