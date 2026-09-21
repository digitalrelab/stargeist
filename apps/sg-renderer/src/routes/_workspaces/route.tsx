import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "#src/shell/index.ts";
import { WorkspaceSidebar } from "#src/workspaces/index.ts";

export const Route = createFileRoute("/_workspaces")({ component: WorkspaceLayout });

function WorkspaceLayout() {
  return (
    <AppShell sidebar={<WorkspaceSidebar />}>
      <Outlet />
    </AppShell>
  );
}
