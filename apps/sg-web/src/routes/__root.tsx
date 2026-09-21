import { createRootRoute, Outlet } from "@tanstack/react-router";
import { RouteError } from "#src/shell/index.ts";

export const Route = createRootRoute({
  component: Outlet,
  notFoundComponent: RouteError,
});
