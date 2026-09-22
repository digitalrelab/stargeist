import { createFileRoute } from "@tanstack/react-router";
import { AIPage } from "#src/settings/pages.ts";

export const Route = createFileRoute("/settings/ai")({ component: AIPage });
