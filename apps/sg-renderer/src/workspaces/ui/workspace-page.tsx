import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button, Skeleton, typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { AsyncResult } from "effect/unstable/reactivity";
import type { ReactNode } from "react";
import { OpenWorkspace, ReconnectWorkspace } from "./workspace-actions";
import { failureMessage } from "#src/client/index.ts";
import { FileBrowser, FileList, FileListSkeleton } from "#src/files/views.ts";
import { WorkArea } from "#src/shell/index.ts";
import type { WorkspaceRecovery } from "../recovery";
import type { WorkspaceListing } from "../state";
import { useWorkspaceState } from "./use-state";

export function WorkspacePage({ workspaceId }: { workspaceId: WorkspaceId }) {
  const detail = useWorkspaceState().detail(workspaceId);
  const { view, recovery, canRefresh } = useAtomValue(detail);
  const refresh = useAtomRefresh(detail);

  let retry;

  if (canRefresh) {
    retry = refresh;
  }

  let workspace;
  let heading: ReactNode = "Workspace";
  let path: ReactNode;

  if (view._tag === "Success") {
    workspace = view.value.workspace;
    heading = workspace.root.split(/[\\/]/).filter(Boolean).at(-1) ?? workspace.root;
    path = workspace.root;
  } else if (view._tag === "Initial" || view.waiting) {
    heading = <Skeleton styles={styles.nameSkeleton} />;
    path = <Skeleton styles={styles.pathSkeleton} />;
  }

  return (
    <WorkArea.Page>
      <WorkArea.Header>
        <div {...stylex.props(styles.title)}>
          <h1 {...stylex.props(typography.label, styles.name)}>{heading}</h1>
          {path !== undefined && (
            <p
              {...stylex.props(typography.label, styles.path)}
              data-selectable
              title={workspace?.root}
            >
              {path}
            </p>
          )}
        </div>
        <Button appearance="ghost" size="sm" onClick={refresh} disabled={!canRefresh}>
          Refresh
        </Button>
      </WorkArea.Header>
      <WorkArea.Content>
        <WorkspaceFiles view={view} retry={retry} workspaceId={workspaceId} recovery={recovery} />
      </WorkArea.Content>
    </WorkArea.Page>
  );
}

function WorkspaceFiles({
  view,
  retry,
  workspaceId,
  recovery,
}: {
  view: AsyncResult.AsyncResult<WorkspaceListing, unknown>;
  retry: (() => void) | undefined;
  workspaceId: WorkspaceId;
  recovery: ReadonlyArray<WorkspaceRecovery>;
}) {
  if (view._tag === "Success" && !view.waiting) {
    return (
      <FileBrowser.Root
        key={view.value.listing.id}
        listing={view.value.listing}
        workspaceId={view.value.workspace.id}
        folder={view.value.workspace.root}
      >
        <FileList />
      </FileBrowser.Root>
    );
  }

  if (view._tag === "Failure" && !view.waiting) {
    return (
      <div {...stylex.props(styles.failure)}>
        <p role="alert">{failureMessage(view.cause)}</p>
        {recovery.includes("locate") && <ReconnectWorkspace workspaceId={workspaceId} />}
        {recovery.includes("open") && <OpenWorkspace />}
        {retry && (
          <Button appearance="soft" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <FileBrowser.Loading>
      <FileListSkeleton />
    </FileBrowser.Loading>
  );
}

const styles = stylex.create({
  title: {
    flexGrow: 1,
    flexBasis: "12rem",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: space[1],
  },
  name: {
    fontWeight: fonts.semibold,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  path: {
    fontWeight: fonts.regular,
    color: colors.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  nameSkeleton: { inlineSize: "10rem", blockSize: space[3] },
  pathSkeleton: { inlineSize: "min(80%, 24rem)", blockSize: space[3] },
  failure: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space[4],
    padding: space[6],
  },
});
