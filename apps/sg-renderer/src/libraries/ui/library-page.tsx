import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId, LibraryId } from "@stargeist/domain";
import { Button, typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { AsyncResult } from "effect/unstable/reactivity";
import { failureMessage } from "#src/client/index.ts";
import { FileBrowser } from "#src/files/views.ts";
import { WorkArea } from "#src/shell/index.ts";
import type { LibraryListing } from "../state";
import { useLibraryState } from "./use-state";

export function LibraryPage({
  workspaceId,
  libraryId,
}: {
  workspaceId: WorkspaceId;
  libraryId: LibraryId;
}) {
  const detail = useLibraryState().detail(workspaceId)(libraryId);
  const { library, listing, canRefresh } = useAtomValue(detail);
  const refresh = useAtomRefresh(detail);

  let retry;

  if (canRefresh) retry = refresh;

  return (
    <WorkArea.Page>
      <WorkArea.Header>
        <div {...stylex.props(styles.title)}>
          <h1 {...stylex.props(typography.label, styles.name)}>
            {library?.displayName ?? "Library"}
          </h1>
          {library && (
            <p
              {...stylex.props(typography.label, styles.path)}
              data-selectable
              title={library.source.path}
            >
              {library.source.path}
            </p>
          )}
        </div>
        <Button appearance="ghost" size="sm" onClick={refresh} disabled={!canRefresh}>
          Refresh
        </Button>
      </WorkArea.Header>
      <WorkArea.Content>
        <LibraryEntries
          entries={listing}
          retry={retry}
          libraryId={libraryId}
          folder={library?.source.path}
        />
      </WorkArea.Content>
    </WorkArea.Page>
  );
}

function LibraryEntries({
  entries,
  retry,
  libraryId,
  folder,
}: {
  entries: AsyncResult.AsyncResult<LibraryListing, unknown>;
  retry: (() => void) | undefined;
  libraryId: LibraryId;
  folder: string | undefined;
}) {
  if (entries._tag === "Success" && !entries.waiting) {
    return (
      <FileBrowser
        key={entries.value.id}
        listing={entries.value.files}
        libraryId={libraryId}
        folder={folder}
      />
    );
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
  message: { padding: space[6], color: colors.textMuted },
  failure: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: space[4],
    padding: space[6],
  },
});
