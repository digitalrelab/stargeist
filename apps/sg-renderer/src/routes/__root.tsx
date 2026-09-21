import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import type { RendererServices } from "#src/application.ts";
import { RouteError } from "#src/shell/index.ts";

export const Route = createRootRouteWithContext<{ application: RendererServices }>()({
  component: Outlet,
  notFoundComponent: RouteError,
});
