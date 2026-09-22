import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button, Skeleton, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { useWorkspaceState } from "./use-state";

export function WorkspacePage({ workspaceId }: { workspaceId: WorkspaceId }) {
  const state = useWorkspaceState();
  const workspace = useAtomValue(state.workspace(workspaceId));
  const refresh = useAtomRefresh(state.workspace(workspaceId));

  let title: ReactNode = <Skeleton styles={styles.titleSkeleton} />;
  let content = (
    <p role="status" aria-label="Loading workspace" {...stylex.props(styles.loading)}>
      <Skeleton styles={styles.descriptionSkeleton} />
    </p>
  );

  if (workspace._tag === "Success") {
    title = workspace.value.displayName;
    content = <p {...stylex.props(styles.description)}>Choose a library in the sidebar.</p>;
  }

  if (workspace._tag === "Failure") {
    title = "Workspace";
    content = (
      <>
        <p role="alert">{failureMessage(workspace.cause)}</p>
        {canRetryFailure(workspace.cause) && (
          <Button onClick={refresh} disabled={workspace.waiting}>
            Retry
          </Button>
        )}
      </>
    );
  }

  return (
    <main {...stylex.props(styles.page)}>
      <h1 {...stylex.props(typography.heading, styles.heading)}>{title}</h1>
      {content}
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
  heading: { maxWidth: "100%" },
  loading: { maxWidth: "100%" },
  titleSkeleton: { inlineSize: "12rem", blockSize: "1em" },
  descriptionSkeleton: { inlineSize: "16rem", blockSize: space[3] },
  description: { color: colors.textMuted },
});
