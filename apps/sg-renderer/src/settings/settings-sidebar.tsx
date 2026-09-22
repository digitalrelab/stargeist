import {
  Button,
  BackIcon,
  SettingsIcon,
  AppearanceIcon,
  AIIcon,
  Sidebar,
  typography,
} from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";

export function SettingsSidebar() {
  return (
    <Sidebar.Root aria-label="Settings">
      <Sidebar.Header>
        <div {...stylex.props(styles.header)}>
          <Button.Link
            appearance="ghost"
            shape="square"
            render={<Link to="/" />}
            aria-label="Back to workspaces"
          >
            <BackIcon aria-hidden="true" />
          </Button.Link>
          <h2 {...stylex.props(typography.label)}>Settings</h2>
        </div>
      </Sidebar.Header>
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
    </Sidebar.Root>
  );
}

const styles = stylex.create({
  header: { display: "flex", alignItems: "center", gap: space[2] },
});
