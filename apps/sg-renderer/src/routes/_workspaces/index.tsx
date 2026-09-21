import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesPage } from "#src/workspaces/pages.ts";

export const Route = createFileRoute("/_workspaces/")({ component: WorkspacesPage });
