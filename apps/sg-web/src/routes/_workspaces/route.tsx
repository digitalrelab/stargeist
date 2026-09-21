import { workspacesLayer } from "#platform";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "#src/shell/index.ts";
import { WorkspaceProvider } from "#src/workspaces/index.ts";
import { WorkspaceSidebar } from "./-components/sidebar";

export const Route = createFileRoute("/_workspaces")({ component: WorkspaceLayout });

function WorkspaceLayout() {
  return (
    <WorkspaceProvider layer={workspacesLayer}>
      <AppShell sidebar={<WorkspaceSidebar />}>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
