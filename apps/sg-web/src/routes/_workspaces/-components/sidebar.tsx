import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@stargeist/ui/button";
import * as Sidebar from "@stargeist/ui/sidebar";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { Link, useNavigate } from "@tanstack/react-router";
import { failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "#src/workspaces/index.ts";

export function WorkspaceSidebar() {
  const { createWorkspace } = useWorkspaceState();
  const creation = useAtomValue(createWorkspace);
  const create = useAtomSet(createWorkspace, { mode: "promiseExit" });
  const navigate = useNavigate();

  const chooseFolder = async () => {
    const result = await create();

    if (result._tag !== "Success" || !result.value) return;

    await navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: result.value.id } });
  };

  return (
    <Sidebar.Root aria-label="Workspaces">
      <Sidebar.Header>
        <Link to="/" {...stylex.props(styles.brand, typography.label)}>
          Stargeist
        </Link>
        <Button onClick={() => void chooseFolder()} disabled={creation.waiting}>
          {creation.waiting ? "Choosing folder…" : "Create workspace"}
        </Button>
        {creation._tag === "Failure" && (
          <p {...stylex.props(styles.message, typography.label)} role="alert">
            {failureMessage(creation.cause)}
          </p>
        )}
      </Sidebar.Header>
      <Sidebar.Nav aria-label="Remembered workspaces">
        <WorkspaceNavigation />
      </Sidebar.Nav>
    </Sidebar.Root>
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
        <Button appearance="ghost" size="sm" onClick={refresh}>
          Retry
        </Button>
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
