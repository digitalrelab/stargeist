import { createFileRoute } from "@tanstack/react-router";
import { WorkspacesPage } from "#src/workspaces/index.ts";

export const Route = createFileRoute("/_workspaces/")({ component: WorkspacesPage });
