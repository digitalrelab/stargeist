import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout, SettingsSidebar } from "#src/settings/index.ts";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
  staticData: {
    primarySidebar: SettingsSidebar,
    breadcrumb: { label: "Settings" },
  },
});
