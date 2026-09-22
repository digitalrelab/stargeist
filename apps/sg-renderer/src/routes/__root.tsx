import { createRootRouteWithContext, Outlet, useMatches } from "@tanstack/react-router";
import type { AtomRegistry } from "effect/unstable/reactivity";
import { useRef, type ComponentType, type RefObject } from "react";
import type { RendererServices } from "#src/application.ts";
import { FileInspectionProvider, FileInspector } from "#src/files/views.ts";
import { AppShell, RouteError, SecondarySidebar, WorkArea } from "#src/shell/index.ts";
import { WorkspaceSidebar } from "#src/workspaces/index.ts";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    primarySidebar?: ComponentType;
  }
}

export const Route = createRootRouteWithContext<{
  application: RendererServices;
  registry: AtomRegistry.AtomRegistry;
}>()({
  component: RootLayout,
  notFoundComponent: RouteError,
  staticData: {
    primarySidebar: WorkspaceSidebar,
    breadcrumb: { label: "Home" },
  },
});

function RootLayout() {
  const frame = useRef<HTMLDivElement>(null);

  return (
    <FileInspectionProvider fallbackFocus={frame}>
      <ApplicationLayout frame={frame} />
    </FileInspectionProvider>
  );
}

function ApplicationLayout({ frame }: { frame: RefObject<HTMLDivElement | null> }) {
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
    <AppShell.Root ref={frame} tabIndex={-1}>
      <AppShell.Navigation>{primarySidebar}</AppShell.Navigation>
      <SecondarySidebar.Layout panel={<FileInspector />}>
        <WorkArea.Root>
          <Outlet />
        </WorkArea.Root>
      </SecondarySidebar.Layout>
    </AppShell.Root>
  );
}
