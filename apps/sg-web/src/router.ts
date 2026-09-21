import { createBrowserHistory, createHashHistory, createRouter } from "@tanstack/react-router";
import { reportFailure } from "@stargeist/std/errors";
import { Cause, Effect } from "effect";
import { RouteError } from "#src/shell/index.ts";
import { routeTree } from "../.generated/route-tree";

export const router = createRouter({
  routeTree,
  history: window.location.protocol === "file:" ? createHashHistory() : createBrowserHistory(),
  defaultErrorComponent: RouteError,
  defaultOnCatch: (error) => Effect.runSync(reportFailure("web.route", Cause.die(error))),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
