import { createFileRoute } from "@tanstack/react-router";
import { SettingsLayout } from "#src/settings/index.ts";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });
