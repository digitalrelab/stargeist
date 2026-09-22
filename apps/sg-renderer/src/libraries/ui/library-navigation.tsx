import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button, Sidebar, Skeleton, typography } from "@stargeist/ui";
import { colors, control, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { AddLibrary } from "./add-library";
import { useLibraryState } from "./use-state";

export function LibraryNavigation({ workspaceId }: { workspaceId: WorkspaceId }) {
  return (
    <>
      <Sidebar.Nav aria-label="Libraries">
        <LibraryLinks workspaceId={workspaceId} />
      </Sidebar.Nav>
      <AddLibrary workspaceId={workspaceId} />
    </>
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
          <Button appearance="ghost" onClick={refresh} disabled={list.waiting}>
            Retry
          </Button>
        )}
      </>
    );
  }

  if (list._tag !== "Success") {
    return (
      <div role="status" aria-label="Loading libraries" {...stylex.props(styles.loading)}>
        {[0, 1, 2].map((index) => (
          <div key={index} {...stylex.props(styles.loadingRow)}>
            <Skeleton styles={styles.nameSkeleton} />
          </div>
        ))}
      </div>
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
  loading: { display: "flex", flexDirection: "column", gap: space[1] },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    height: control.heightMd,
    paddingInline: control.paddingInlineMd,
  },
  nameSkeleton: { inlineSize: "70%", blockSize: space[3] },
  message: { color: colors.textMuted, overflowWrap: "anywhere" },
});
