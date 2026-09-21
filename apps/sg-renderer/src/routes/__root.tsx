import { useAtomValue } from "@effect/atom-react";
import { createRootRouteWithContext, Outlet, useMatches } from "@tanstack/react-router";
import { useRef, type ComponentType, type RefObject } from "react";
import type { RendererServices } from "#src/application.ts";
import { FileInspectionProvider, FileInspector, useFileInspection } from "#src/files/views.ts";
import { AppShell, RouteError } from "#src/shell/index.ts";
import { WorkspaceSidebar } from "#src/workspaces/index.ts";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    primarySidebar?: ComponentType;
  }
}

export const Route = createRootRouteWithContext<{ application: RendererServices }>()({
  component: RootLayout,
  notFoundComponent: RouteError,
  staticData: { primarySidebar: WorkspaceSidebar },
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
  const inspection = useFileInspection();
  const inspectorOpen = useAtomValue(inspection.isOpen);
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

  let secondarySidebar;

  if (inspectorOpen) {
    secondarySidebar = <FileInspector />;
  }

  return (
    <AppShell
      ref={frame}
      tabIndex={-1}
      primarySidebar={primarySidebar}
      secondarySidebar={secondarySidebar}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || event.defaultPrevented || !inspectorOpen) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        inspection.close();
      }}
    >
      <Outlet />
    </AppShell>
  );
}
