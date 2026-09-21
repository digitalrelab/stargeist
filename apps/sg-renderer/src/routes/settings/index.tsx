import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "#src/settings/index.ts";

export const Route = createFileRoute("/settings/")({ component: SettingsPage });
