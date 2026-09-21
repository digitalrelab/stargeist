import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { DirectoryListingPage } from "@stargeist/domain/filesystem";
import type { Workspace, WorkspaceId } from "@stargeist/domain/workspaces";
import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import type { AsyncResult } from "effect/unstable/reactivity";
import { failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "#src/workspaces/index.ts";
import { EntryList } from "./entry-list";

export function WorkspaceScreen({ id }: { id: WorkspaceId }) {
  const { directory, workspace } = useWorkspaceState();
  const details = useAtomValue(workspace(id));
  const entries = useAtomValue(directory(id));
  const refreshDirectory = useAtomRefresh(directory(id));
  const refreshWorkspace = useAtomRefresh(workspace(id));

  const refresh = () => {
    refreshWorkspace();
    refreshDirectory();
  };

  return (
    <main {...stylex.props(styles.screen)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.title)}>
          <h1 {...stylex.props(styles.name, typography.heading)}>
            {details._tag === "Success" ? details.value.name : "Workspace"}
          </h1>
          {details._tag === "Success" && (
            <p {...stylex.props(styles.path, typography.label)} data-selectable>
              {details.value.rootPath}
            </p>
          )}
        </div>
        <Button appearance="soft" size="sm" onClick={refresh} disabled={entries.waiting}>
          Refresh
        </Button>
      </header>
      <WorkspaceEntries details={details} entries={entries} retry={refresh} />
    </main>
  );
}

function WorkspaceEntries({
  details,
  entries,
  retry,
}: {
  details: AsyncResult.AsyncResult<Workspace, unknown>;
  entries: AsyncResult.AsyncResult<DirectoryListingPage, unknown>;
  retry: () => void;
}) {
  if (details._tag === "Failure") {
    return <Failure message={failureMessage(details.cause)} retry={retry} />;
  }

  if (entries._tag === "Success" && !entries.waiting) {
    return <EntryList key={entries.value.listingId} initial={entries.value} />;
  }

  if (entries._tag === "Failure" && !entries.waiting) {
    return <Failure message={failureMessage(entries.cause)} retry={retry} />;
  }

  return (
    <p {...stylex.props(styles.message)} role="status">
      Opening folder…
    </p>
  );
}

function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div {...stylex.props(styles.failure)}>
      <p role="alert">{message}</p>
      <Button appearance="soft" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}

const styles = stylex.create({
  screen: { display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 },
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
