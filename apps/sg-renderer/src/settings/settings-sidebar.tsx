import { Button, BackIcon, Sidebar, typography } from "@stargeist/ui";
import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

export function SettingsSidebar() {
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
          <Button.Link
            appearance="ghost"
            size="icon"
            render={<Link to="/" />}
            aria-label="Back to workspaces"
          >
            <BackIcon aria-hidden="true" />
          </Button.Link>
        </Sidebar.Nav>
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}
