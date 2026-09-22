import { createRootRouteWithContext, Outlet, useMatches } from "@tanstack/react-router";
import type { ComponentType } from "react";
import type { RendererServices } from "#src/application.ts";
import { FileInspectionProvider, FileInspector } from "#src/files/views.ts";
import { AppShell, RouteError, SecondarySidebar, WorkArea } from "#src/shell/index.ts";
import { WorkspaceSidebar } from "#src/workspaces/index.ts";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    primarySidebar?: ComponentType;
  }
}

export const Route = createRootRouteWithContext<{ application: RendererServices }>()({
  component: RootLayout,
  notFoundComponent: RouteError,
  staticData: {
    primarySidebar: WorkspaceSidebar,
    breadcrumb: { label: "Home" },
  },
});

function RootLayout() {
  const PrimarySidebar = useMatches({
    select: (matches) => {
      let primarySidebar;

      for (const match of matches) {
        if (match.staticData.primarySidebar) {
          primarySidebar = match.staticData.primarySidebar;
        }
      }

      return primarySidebar;
    },
  });

  let primarySidebar;

  if (PrimarySidebar) {
    primarySidebar = <PrimarySidebar />;
  }

  return (
    <FileInspectionProvider>
      <AppShell.Root>
        <AppShell.Navigation>{primarySidebar}</AppShell.Navigation>
        <SecondarySidebar.Layout panel={<FileInspector />}>
          <WorkArea.Root>
            <Outlet />
          </WorkArea.Root>
        </SecondarySidebar.Layout>
      </AppShell.Root>
    </FileInspectionProvider>
  );
}
