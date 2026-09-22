import {
  AIIcon,
  AppearanceIcon,
  BackIcon,
  Button,
  SettingsIcon,
  Sidebar,
  Tooltip,
} from "@stargeist/ui";
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
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button.Link
                  appearance="ghost"
                  shape="square"
                  render={<Link to="/" />}
                  aria-label="Back"
                />
              }
            >
              <BackIcon aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Popup side="right">Back</Tooltip.Popup>
          </Tooltip.Root>
        </Sidebar.Nav>
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}
