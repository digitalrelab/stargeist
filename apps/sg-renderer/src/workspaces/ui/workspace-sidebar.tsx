import { Button, SettingsIcon, Sidebar, typography } from "@stargeist/ui";
import * as stylex from "@stylexjs/stylex";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import { Link, useParams } from "@tanstack/react-router";
import { OpenWorkspace, ForgetWorkspace } from "./workspace-actions";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function WorkspaceSidebar() {
  const { workspaceId } = useParams({ strict: false });

  return (
    <Sidebar.Root aria-label="Workspace navigation">
      <Sidebar.Header>
        <WorkspaceSwitcher workspaceId={workspaceId} />
        <OpenWorkspace />
      </Sidebar.Header>
      <Sidebar.Content key={workspaceId}>
        {workspaceId && (
          <Button.Link appearance="ghost" render={<Link to="/" />}>
            Close workspace
          </Button.Link>
        )}
        <details>
          <summary {...stylex.props(typography.label, styles.options)}>Workspace options</summary>
          <div {...stylex.props(styles.actions)}>
            <OpenWorkspace mode="initialize" />
            {workspaceId && <ForgetWorkspace workspaceId={workspaceId} />}
          </div>
        </details>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Nav aria-label="Application">
          <Button.Link
            appearance="ghost"
            shape="square"
            render={<Link to="/settings" />}
            aria-label="Settings"
          >
            <SettingsIcon aria-hidden="true" />
          </Button.Link>
        </Sidebar.Nav>
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}

const styles = stylex.create({
  options: {
    color: colors.textMuted,
    paddingBlock: space[2],
    paddingInline: space[3],
  },
  actions: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: space[2] },
});
