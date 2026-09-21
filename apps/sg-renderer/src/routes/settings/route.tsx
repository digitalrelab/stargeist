import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsSidebar } from "#src/settings/index.ts";

export const Route = createFileRoute("/settings")({
  component: Outlet,
  staticData: { primarySidebar: SettingsSidebar },
});
