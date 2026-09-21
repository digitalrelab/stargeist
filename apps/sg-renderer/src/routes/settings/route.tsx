import * as Sidebar from "@stargeist/ui/sidebar";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "#src/shell/index.ts";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

function SettingsLayout() {
  return (
    <AppShell sidebar={<SettingsSidebar />}>
      <Outlet />
    </AppShell>
  );
}

function SettingsSidebar() {
  return (
    <Sidebar.Root aria-label="Settings">
      <Sidebar.Header>
        <h2 {...stylex.props(typography.heading)}>Settings</h2>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Nav aria-label="Settings sections">
          <Sidebar.Link render={<Link to="/settings" activeOptions={{ exact: true }} />}>
            General
          </Sidebar.Link>
        </Sidebar.Nav>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Nav aria-label="Application">
          <Sidebar.Link render={<Link to="/" />}>Back to workspaces</Sidebar.Link>
        </Sidebar.Nav>
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}
