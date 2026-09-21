import { Button, SettingsIcon, Sidebar } from "@stargeist/ui";
import { Link, useParams } from "@tanstack/react-router";
import { LibraryNavigation } from "#src/libraries/index.ts";
import { CreateWorkspace } from "./create-workspace";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function WorkspaceSidebar() {
  const { workspaceId } = useParams({ strict: false });

  return (
    <Sidebar.Root aria-label="Workspace navigation">
      <Sidebar.Header>
        <WorkspaceSwitcher workspaceId={workspaceId} />
        <CreateWorkspace />
      </Sidebar.Header>
      <Sidebar.Content key={workspaceId}>
        {workspaceId && <LibraryNavigation workspaceId={workspaceId} />}
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Nav aria-label="Application">
          <Button.Link
            appearance="ghost"
            size="icon"
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
