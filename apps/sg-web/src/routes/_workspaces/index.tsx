import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceHome } from "./-components/home";

export const Route = createFileRoute("/_workspaces/")({ component: WorkspaceHome });
