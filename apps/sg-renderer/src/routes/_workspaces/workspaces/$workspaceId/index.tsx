import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { WorkspaceId } from "@stargeist/domain/workspaces";
import { Button, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "#src/workspaces/index.ts";

export const Route = createFileRoute("/_workspaces/workspaces/$workspaceId/")({
  params: {
    parse: ({ workspaceId }) => ({
      workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId),
    }),
  },
  component: WorkspacePage,
});

function WorkspacePage() {
  const { workspaceId } = Route.useParams();
  const state = useWorkspaceState();
  const workspace = useAtomValue(state.workspace(workspaceId));
  const refresh = useAtomRefresh(state.workspace(workspaceId));

  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading)}>
        {workspace._tag === "Success" ? workspace.value.displayName : "Workspace"}
      </h1>
      {workspace._tag === "Failure" ? (
        <>
          <p role="alert">{failureMessage(workspace.cause)}</p>
          {canRetryFailure(workspace.cause) && (
            <Button onClick={refresh} disabled={workspace.waiting}>
              Retry
            </Button>
          )}
        </>
      ) : workspace._tag !== "Success" ? (
        <p role="status">Loading workspace…</p>
      ) : (
        <p {...stylex.props(styles.description)}>
          Choose a library in the sidebar or add another folder.
        </p>
      )}
    </main>
  );
}

const styles = stylex.create({
  page: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space[4],
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    padding: { default: space[8], "@media (max-width: 640px)": space[4] },
  },
  description: { color: colors.textMuted },
});
