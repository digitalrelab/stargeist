import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button, Sidebar, typography } from "@stargeist/ui";
import { colors } from "@stargeist/ui/tokens.stylex";
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
  message: { color: colors.textMuted, overflowWrap: "anywhere" },
});
