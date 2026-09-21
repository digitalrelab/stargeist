import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import {
  type FileSystemEntry,
  type DirectoryListingPage,
  entryPageSize,
} from "@stargeist/domain/filesystem";
import { Button } from "@stargeist/ui/button";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import { typography } from "@stargeist/ui/typography";
import * as stylex from "@stylexjs/stylex";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useMemo, useRef } from "react";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState, type DirectoryView } from "#src/workspaces/index.ts";

const rowHeight = 40;

const entryLabels: Record<FileSystemEntry["kind"], string> = {
  directory: "Folder",
  file: "File",
  symlink: "Link",
  other: "Other",
};

export function EntryList({ initial }: { initial: DirectoryListingPage }) {
  const { directoryView } = useWorkspaceState();
  const view = useMemo(() => directoryView(initial), [directoryView, initial]);
  const extent = useAtomValue(view.extent);
  const viewport = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: extent.count + (extent.hasMore ? 1 : 0),
    getScrollElement: () => viewport.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const groups = new Map<number, VirtualItem[]>();

  for (const item of virtualizer.getVirtualItems()) {
    const offset = Math.floor(item.index / entryPageSize) * entryPageSize;
    const group = groups.get(offset) ?? [];
    group.push(item);
    groups.set(offset, group);
  }

  return (
    <>
      <div {...stylex.props(styles.columns, styles.heading, typography.label)} aria-hidden="true">
        <span>Name</span>
        <span>Kind</span>
      </div>
      {extent.count === 0 && !extent.hasMore ? (
        <p {...stylex.props(styles.empty)}>This folder is empty.</p>
      ) : (
        <div
          ref={viewport}
          {...stylex.props(styles.viewport)}
          role="list"
          aria-label="Folder entries"
          tabIndex={0}
        >
          <div {...stylex.props(styles.content(virtualizer.getTotalSize()))}>
            {[...groups].map(([offset, items]) => (
              <PageRows
                key={offset}
                offset={offset}
                items={items}
                view={view}
                total={extent.hasMore ? -1 : extent.count}
              />
            ))}
          </div>
        </div>
      )}
      <p {...stylex.props(styles.footer, typography.label)}>
        {extent.count.toLocaleString()} {extent.count === 1 ? "entry" : "entries"}
        {extent.hasMore ? " · Scroll for more" : ""}
      </p>
    </>
  );
}

function PageRows({
  offset,
  items,
  view,
  total,
}: {
  offset: number;
  items: VirtualItem[];
  view: DirectoryView;
  total: number;
}) {
  const atom = view.pages(offset);
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);

  if (result._tag !== "Success") {
    const first = items[0];

    if (!first) return null;

    return (
      <div
        {...stylex.props(styles.columns, styles.row(first.start), styles.status)}
        role="listitem"
      >
        {result._tag === "Failure" ? (
          <>
            <span role="alert">{failureMessage(result.cause)}</span>
            {canRetryFailure(result.cause) && (
              <Button appearance="soft" size="sm" onClick={refresh} disabled={result.waiting}>
                Retry
              </Button>
            )}
          </>
        ) : (
          <span role="status">Loading entries…</span>
        )}
      </div>
    );
  }

  return items.map((item) => {
    const entry = result.value.entries[item.index - offset];

    if (!entry) return null;

    return (
      <div
        key={entry.name}
        {...stylex.props(styles.columns, styles.row(item.start), typography.label)}
        role="listitem"
        aria-posinset={item.index + 1}
        aria-setsize={total}
      >
        <span {...stylex.props(styles.name)}>{entry.name}</span>
        <span {...stylex.props(styles.kind)}>{entryLabels[entry.kind]}</span>
      </div>
    );
  });
}

const styles = stylex.create({
  columns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 6rem",
    gap: space[4],
    paddingInline: space[6],
  },
  heading: {
    paddingBlock: space[3],
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.border,
    color: colors.textMuted,
  },
  viewport: {
    flexGrow: 1,
    minHeight: 0,
    overflow: "auto",
    outlineColor: colors.focusRing,
    outlineOffset: -2,
  },
  content: (height: number) => ({ height, position: "relative", width: "100%" }),
  row: (top: number) => ({
    position: "absolute",
    top: 0,
    transform: `translateY(${top}px)`,
    left: 0,
    right: 0,
    height: rowHeight,
    alignItems: "center",
  }),
  name: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  kind: { color: colors.textMuted },
  status: { display: "flex", color: colors.textMuted },
  empty: { padding: space[6], color: colors.textMuted, flexGrow: 1 },
  footer: {
    paddingBlock: space[3],
    paddingInline: space[6],
    color: colors.textMuted,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors.border,
  },
});
