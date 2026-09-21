import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "#src/shell/index.ts";
import { WorkspaceProvider } from "#src/workspaces/index.ts";
import { WorkspaceSidebar } from "./-sidebar";

export const Route = createFileRoute("/_workspaces")({ component: WorkspaceLayout });

function WorkspaceLayout() {
  const { application } = Route.useRouteContext();

  return (
    <WorkspaceProvider client={application.workspaces}>
      <AppShell sidebar={<WorkspaceSidebar />}>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
