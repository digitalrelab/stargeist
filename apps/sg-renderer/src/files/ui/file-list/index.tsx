import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Selection } from "@stargeist/std/selection";
import { HashSet } from "effect";
import { Button, ScrollArea, typography } from "@stargeist/ui";
import { colors, control, fonts, radii, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { defaultRangeExtractor, useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useEffect } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import {
  FileListContext,
  useFileList,
  useFileListContext,
  rowHeight,
  type FileListProps,
} from "./context";
import { FileRow } from "./row";

export function FileList(props: FileListProps) {
  const list = useFileList(props);
  const { listing, gridId, active, column } = list;
  const extent = useAtomValue(listing.extent);
  let count = extent.count;
  let total = extent.count;
  if (extent.hasMore) {
    count += 1;
    total = -1;
  }

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => list.viewportProps.ref.current,
    estimateSize: () => rowHeight,
    overscan: 8,
    paddingStart: 8,
    paddingEnd: 8,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (active !== undefined && active < count && !indexes.includes(active)) {
        if (active < range.startIndex) indexes.unshift(active);
        else indexes.push(active);
      }
      return indexes;
    },
  });

  useEffect(() => {
    if (active !== undefined) virtualizer.scrollToIndex(active, { align: "auto" });
  }, [active, virtualizer]);

  const groups = new Map<number, VirtualItem[]>();
  for (const item of virtualizer.getVirtualItems()) {
    const offset = listing.pageOffset(item.index);
    const group = groups.get(offset) ?? [];
    group.push(item);
    groups.set(offset, group);
  }

  let activeDescendant;
  if (active !== undefined && active < count) {
    activeDescendant = `${gridId}-${active}-${column}`;
  }

  let content = (
    <ScrollArea.Root>
      <ScrollArea.Viewport
        {...list.viewportProps}
        role="grid"
        aria-label="Folder entries"
        aria-rowcount={total}
        aria-colcount={2}
        aria-multiselectable
        aria-activedescendant={activeDescendant}
      >
        <ScrollArea.Content
          render={<div {...stylex.props(styles.content(virtualizer.getTotalSize()))} />}
        >
          {[...groups].map(([offset, items]) => (
            <PageRows key={offset} offset={offset} items={items} />
          ))}
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
    </ScrollArea.Root>
  );

  if (extent.count === 0 && !extent.hasMore)
    content = <p {...stylex.props(styles.empty)}>This folder is empty.</p>;

  return (
    <FileListContext value={list}>
      {content}
      <ListFooter />
    </FileListContext>
  );
}

function PageRows({ offset, items }: { offset: number; items: VirtualItem[] }) {
  const { listing, gridId, active, focused, retry: retrySelection } = useFileListContext();
  const atom = listing.pages(offset);
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);

  if (result._tag !== "Success") {
    const first = items.find((item) => item.index === active) ?? items[0];
    if (!first) return null;
    let retry = refresh;
    if (active !== undefined && listing.pageOffset(active) === offset) retry = retrySelection;
    let content = <span role="status">Loading entries…</span>;
    if (result._tag === "Failure") {
      content = (
        <>
          <span role="alert">{failureMessage(result.cause)}</span>
          {canRetryFailure(result.cause) && (
            <Button appearance="soft" size="sm" onClick={retry} disabled={result.waiting}>
              Retry
            </Button>
          )}
        </>
      );
    }
    return (
      <div
        {...stylex.props(
          typography.label,
          styles.row(first.start),
          styles.status,
          focused && first.index === active && styles.activeStatus,
        )}
        role="row"
        aria-rowindex={first.index + 1}
      >
        <span role="gridcell" id={`${gridId}-${first.index}-0`} />
        <div
          role="gridcell"
          id={`${gridId}-${first.index}-1`}
          {...stylex.props(styles.statusContent)}
        >
          {content}
        </div>
      </div>
    );
  }

  return items.map((item) => {
    const entry = result.value.items[item.index - offset];
    if (!entry) return null;
    return (
      <div key={entry.name} {...stylex.props(styles.row(item.start))}>
        <FileRow entry={entry} index={item.index} />
      </div>
    );
  });
}

function ListFooter() {
  const list = useFileListContext();
  const extent = useAtomValue(list.listing.extent);
  const selection = useAtomValue(list.selection.selection);
  const request = useAtomValue(list.selection.request);
  const operation = useAtomValue(list.selection.operation);
  let total: number | undefined;
  if (!extent.hasMore) total = extent.count;
  const count = Selection.count(selection, total);
  let label = `${extent.count.toLocaleString()} entries`;
  if (extent.count === 1) label = "1 entry";
  if (extent.hasMore) label += " · Scroll for more";
  let hasSelection = false;
  if (selection.mode === "all") {
    hasSelection = true;
    label = "All entries selected";
    const excluded = HashSet.size(selection.excludedKeys);
    if (excluded > 0) label += ` except ${excluded.toLocaleString()}`;
  }
  if (count !== undefined && (count > 0 || selection.mode === "all")) {
    hasSelection = true;
    label = `${count.toLocaleString()} selected`;
  }
  let action;
  if (hasSelection)
    action = (
      <Button appearance="ghost" size="sm" onClick={list.clear}>
        Clear selection
      </Button>
    );
  if (request.waiting && operation === "range") {
    label = "Selecting range…";
    action = (
      <Button appearance="ghost" size="sm" onClick={list.cancel}>
        Cancel
      </Button>
    );
  }
  return (
    <div {...stylex.props(typography.label, styles.footer)}>
      <span role="status">{label}</span>
      {action}
      {request._tag === "Failure" && (
        <>
          <span role="alert">{failureMessage(request.cause)}</span>
          {canRetryFailure(request.cause) && (
            <Button appearance="soft" size="sm" onClick={list.retry} disabled={request.waiting}>
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}

const styles = stylex.create({
  content: (height: number) => ({ height, position: "relative", width: "100%" }),
  row: (top: number) => ({
    position: "absolute",
    top: 0,
    transform: `translateY(${top}px)`,
    left: space[2],
    right: space[2],
    height: rowHeight,
    alignItems: "center",
  }),
  statusContent: { display: "flex", alignItems: "center", gap: space[3] },
  status: {
    display: "flex",
    gap: space[3],
    paddingInline: space[6],
    color: colors.textMuted,
  },
  activeStatus: {
    backgroundColor: `color-mix(in srgb, ${colors.text} 10%, transparent)`,
    borderRadius: radii.md,
    outlineColor: "Highlight",
    outlineWidth: 1,
    outlineOffset: -1,
    outlineStyle: { default: "none", "@media (forced-colors: active)": "solid" },
  },
  empty: { padding: space[6], color: colors.textMuted, flexGrow: 1 },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    minHeight: `calc(${control.heightSm} + ${space[6]} + 1px)`,
    flexShrink: 0,
    fontWeight: fonts.regular,
    paddingBlock: space[3],
    paddingInline: space[6],
    color: colors.textMuted,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: colors.borderSubtle,
  },
});
