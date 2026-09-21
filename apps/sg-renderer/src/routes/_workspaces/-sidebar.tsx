import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, SettingsIcon, Sidebar, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Link, useParams } from "@tanstack/react-router";
import type { WorkspaceId } from "@stargeist/domain";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { useLibraryState, AddLibrary } from "#src/libraries/index.ts";
import { CreateWorkspace, useWorkspaceState } from "#src/workspaces/index.ts";

export function WorkspaceSidebar() {
  return (
    <Sidebar.Root aria-label="Workspaces">
      <Sidebar.Header>
        <Link to="/" {...stylex.props(styles.brand, typography.label)}>
          Stargeist
        </Link>
        <CreateWorkspace />
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Nav aria-label="Remembered workspaces">
          <WorkspaceNavigation />
        </Sidebar.Nav>
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Nav aria-label="Application">
          <Button
            appearance="ghost"
            size="icon"
            render={<Link to="/settings" />}
            aria-label="Settings"
          >
            <SettingsIcon aria-hidden="true" />
          </Button>
        </Sidebar.Nav>
      </Sidebar.Footer>
    </Sidebar.Root>
  );
}

function WorkspaceNavigation() {
  const { workspaceId } = useParams({ strict: false });
  const { workspaces } = useWorkspaceState();
  const list = useAtomValue(workspaces);
  const refresh = useAtomRefresh(workspaces);

  if (list._tag === "Failure") {
    return (
      <div {...stylex.props(styles.error)}>
        <p {...stylex.props(styles.message, typography.label)} role="alert">
          {failureMessage(list.cause)}
        </p>
        {canRetryFailure(list.cause) && (
          <Button appearance="ghost" size="sm" onClick={refresh} disabled={list.waiting}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (list._tag !== "Success") {
    return (
      <p {...stylex.props(styles.message, typography.label)} role="status">
        Loading workspaces…
      </p>
    );
  }

  if (list.value.length === 0) {
    return <p {...stylex.props(styles.message, typography.label)}>No workspaces yet.</p>;
  }

  return list.value.map((workspace) => (
    <div key={workspace.id}>
      <Sidebar.Link
        render={
          <Link
            to="/workspaces/$workspaceId"
            params={{ workspaceId: workspace.id }}
            activeOptions={{ exact: true }}
          />
        }
      >
        {workspace.displayName}
      </Sidebar.Link>
      {workspaceId === workspace.id && <LibraryNavigation workspaceId={workspace.id} />}
    </div>
  ));
}

function LibraryNavigation({ workspaceId }: { workspaceId: WorkspaceId }) {
  return (
    <div {...stylex.props(styles.libraries)}>
      <LibraryLinks workspaceId={workspaceId} />
      <AddLibrary workspaceId={workspaceId} />
    </div>
  );
}

function LibraryLinks({ workspaceId }: { workspaceId: WorkspaceId }) {
  const { libraries } = useLibraryState();
  const list = useAtomValue(libraries(workspaceId));
  const refresh = useAtomRefresh(libraries(workspaceId));

  if (list._tag === "Failure") {
    return (
      <>
        <p role="alert" {...stylex.props(styles.message, typography.label)}>
          {failureMessage(list.cause)}
        </p>
        {canRetryFailure(list.cause) && (
          <Button appearance="ghost" size="sm" onClick={refresh} disabled={list.waiting}>
            Retry
          </Button>
        )}
      </>
    );
  }

  if (list._tag !== "Success") {
    return (
      <p role="status" {...stylex.props(styles.message, typography.label)}>
        Loading libraries…
      </p>
    );
  }

  if (list.value.length === 0) {
    return <p {...stylex.props(styles.message, typography.label)}>No libraries yet.</p>;
  }

  return list.value.map((library) => (
    <Sidebar.Link
      key={library.id}
      render={
        <Link
          to="/workspaces/$workspaceId/libraries/$libraryId"
          params={{ workspaceId, libraryId: library.id }}
        />
      }
    >
      {library.displayName}
    </Sidebar.Link>
  ));
}

const styles = stylex.create({
  libraries: {
    display: "flex",
    flexDirection: "column",
    gap: space[1],
    paddingInlineStart: space[3],
  },
  brand: { color: colors.text, textDecoration: "none", paddingBlock: space[2] },
  message: { color: colors.textMuted, overflowWrap: "anywhere" },
  error: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[2] },
});
