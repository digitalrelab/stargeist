import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { DirectoryListingPage } from "@stargeist/domain/filesystem";
import { WorkspaceId } from "@stargeist/domain/workspaces";
import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import type { AsyncResult } from "effect/unstable/reactivity";
import { failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "#src/workspaces/index.ts";
import { EntryList } from "./-entry-list";

export const Route = createFileRoute("/_workspaces/workspaces/$workspaceId/")({
  params: {
    parse: ({ workspaceId }) => ({
      workspaceId: Schema.decodeUnknownSync(WorkspaceId)(workspaceId),
    }),
  },
  component: WorkspaceDetailPage,
});

function WorkspaceDetailPage() {
  const { workspaceId } = Route.useParams();
  const detail = useWorkspaceState().detail(workspaceId);
  const { workspace, listing, canRefresh } = useAtomValue(detail);
  const refresh = useAtomRefresh(detail);

  return (
    <main {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.title)}>
          <h1 {...stylex.props(styles.name, typography.heading)}>
            {workspace?.name ?? "Workspace"}
          </h1>
          {workspace && (
            <p {...stylex.props(styles.path, typography.label)} data-selectable>
              {workspace.rootPath}
            </p>
          )}
        </div>
        <Button appearance="soft" size="sm" onClick={refresh} disabled={!canRefresh}>
          Refresh
        </Button>
      </header>
      <WorkspaceEntries entries={listing} retry={canRefresh ? refresh : undefined} />
    </main>
  );
}

function WorkspaceEntries({
  entries,
  retry,
}: {
  entries: AsyncResult.AsyncResult<DirectoryListingPage, unknown>;
  retry: (() => void) | undefined;
}) {
  if (entries._tag === "Success" && !entries.waiting) {
    return <EntryList key={entries.value.listingId} initial={entries.value} />;
  }

  if (entries._tag === "Failure" && !entries.waiting) {
    return (
      <div {...stylex.props(styles.failure)}>
        <p role="alert">{failureMessage(entries.cause)}</p>
        {retry && (
          <Button appearance="soft" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <p {...stylex.props(styles.message)} role="status">
      Opening folder…
    </p>
  );
}

const styles = stylex.create({
  page: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 },
  header: {
    display: "flex",
    flexWrap: "wrap",
    flexShrink: 0,
    alignItems: "center",
    gap: space[4],
    padding: space[6],
  },
  title: {
    flexGrow: 1,
    flexBasis: "12rem",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: space[1],
  },
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  path: {
    color: colors.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  message: { padding: space[6], color: colors.textMuted },
  failure: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space[4],
    padding: space[6],
  },
});
