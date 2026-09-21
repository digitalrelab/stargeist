import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "#src/settings/pages.ts";

export const Route = createFileRoute("/settings/")({ component: SettingsPage });
