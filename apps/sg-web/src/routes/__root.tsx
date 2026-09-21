import { reportFailure } from "@stargeist/std/errors";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Cause, Effect } from "effect";
import { RouteError } from "#src/shell/index.ts";

export const Route = createRootRoute({
  component: Outlet,
  errorComponent: RouteError,
  notFoundComponent: RouteError,
  onCatch: (error) => Effect.runSync(reportFailure("web.route", Cause.die(error))),
});
