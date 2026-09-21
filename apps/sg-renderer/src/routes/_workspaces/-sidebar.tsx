import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button, SettingsIcon, Sidebar, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Link, useNavigate } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "#src/workspaces/index.ts";

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

function CreateWorkspace() {
  const { createWorkspace } = useWorkspaceState();
  const creation = useAtomValue(createWorkspace);
  const create = useAtomSet(createWorkspace, { mode: "promiseExit" });
  const navigate = useNavigate();
  const canCreate =
    !creation.waiting && (creation._tag !== "Failure" || canRetryFailure(creation.cause));

  const chooseFolder = async () => {
    if (!canCreate) return;

    const result = await create();

    if (result._tag !== "Success" || !result.value) return;

    await navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: result.value.id } });
  };

  return (
    <>
      <Button onClick={() => void chooseFolder()} disabled={!canCreate}>
        {creation.waiting ? "Choosing folder…" : "Create workspace"}
      </Button>
      {creation._tag === "Failure" && (
        <p {...stylex.props(styles.message, typography.label)} role="alert">
          {failureMessage(creation.cause)}
        </p>
      )}
    </>
  );
}

function WorkspaceNavigation() {
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
    <Sidebar.Link
      key={workspace.id}
      render={<Link to="/workspaces/$workspaceId" params={{ workspaceId: workspace.id }} />}
    >
      {workspace.name}
    </Sidebar.Link>
  ));
}

const styles = stylex.create({
  brand: { color: colors.text, textDecoration: "none", paddingBlock: space[2] },
  message: { color: colors.textMuted, overflowWrap: "anywhere" },
  error: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[2] },
});
