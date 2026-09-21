import { createFileRoute } from "@tanstack/react-router";
import { AppearancePage } from "#src/settings/pages.ts";

export const Route = createFileRoute("/settings/appearance")({ component: AppearancePage });
