import { AIIcon, AppearanceIcon, BackIcon, Button, SettingsIcon, Sidebar } from "@stargeist/ui";
import { Link } from "@tanstack/react-router";

export function SettingsSidebar() {
  return (
    <Sidebar.Root aria-label="Settings">
      <Sidebar.Content>
        <Sidebar.Nav aria-label="Settings sections">
          <Sidebar.Link
            icon={<SettingsIcon />}
            render={<Link to="/settings" activeOptions={{ exact: true }} />}
          >
            General
          </Sidebar.Link>
          <Sidebar.Link icon={<AppearanceIcon />} render={<Link to="/settings/appearance" />}>
            Appearance
          </Sidebar.Link>
          <Sidebar.Link icon={<AIIcon />} render={<Link to="/settings/ai" />}>
            AI
          </Sidebar.Link>
        </Sidebar.Nav>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Nav aria-label="Application">
          <Button.Link
            appearance="ghost"
            shape="circle"
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
