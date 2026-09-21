import { useAtomValue } from "@effect/atom-react";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { failureMessage } from "#src/rpc/index.ts";
import { AppShell } from "#src/shell/index.ts";
import { WorkspaceProvider, workspacesLayer, useWorkspaceState } from "#src/workspaces/index.ts";
import { WorkspaceSidebar } from "./-sidebar";

export const Route = createFileRoute("/_workspaces")({ component: WorkspaceRoute });

function WorkspaceRoute() {
  return (
    <WorkspaceProvider layer={workspacesLayer}>
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}

function WorkspaceLayout() {
  const { runtime } = useWorkspaceState();
  const startup = useAtomValue(runtime);

  return (
    <AppShell sidebar={<WorkspaceSidebar />}>
      {startup._tag === "Success" ? (
        <Outlet />
      ) : (
        <main {...stylex.props(styles.status)}>
          <p role={startup._tag === "Failure" ? "alert" : "status"}>
            {startup._tag === "Failure" ? failureMessage(startup.cause) : "Opening workspaces…"}
          </p>
        </main>
      )}
    </AppShell>
  );
}

const styles = stylex.create({
  status: { padding: space[8], color: colors.textMuted, minHeight: 0, overflowY: "auto" },
});
