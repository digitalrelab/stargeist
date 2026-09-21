import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useRef } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import type { FileListing } from "../state";
import { FileRow } from "./file-row";

const rowHeight = 40;

export function FileList({ listing }: { listing: FileListing }) {
  const extent = useAtomValue(listing.extent);
  const viewport = useRef<HTMLDivElement>(null);
  let count = extent.count;
  let total = extent.count;
  let entryLabel = "entries";

  if (extent.hasMore) {
    count += 1;
    total = -1;
  }

  if (extent.count === 1) entryLabel = "entry";

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => viewport.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const groups = new Map<number, VirtualItem[]>();

  for (const item of virtualizer.getVirtualItems()) {
    const offset = listing.pageOffset(item.index);
    const group = groups.get(offset) ?? [];
    group.push(item);
    groups.set(offset, group);
  }

  let content = (
    <div
      ref={viewport}
      {...stylex.props(styles.viewport)}
      role="list"
      aria-label="Folder entries"
      tabIndex={0}
    >
      <div {...stylex.props(styles.content(virtualizer.getTotalSize()))}>
        {[...groups].map(([offset, items]) => (
          <PageRows key={offset} offset={offset} items={items} listing={listing} total={total} />
        ))}
      </div>
    </div>
  );

  if (extent.count === 0 && !extent.hasMore) {
    content = <p {...stylex.props(styles.empty)}>This folder is empty.</p>;
  }

  return (
    <>
      {content}
      <p {...stylex.props(typography.label, styles.footer)}>
        {extent.count.toLocaleString()} {entryLabel}
        {extent.hasMore && " · Scroll for more"}
      </p>
    </>
  );
}

function PageRows({
  offset,
  items,
  listing,
  total,
}: {
  offset: number;
  items: VirtualItem[];
  listing: FileListing;
  total: number;
}) {
  const atom = listing.pages(offset);
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);

  if (result._tag !== "Success") {
    const first = items[0];

    if (!first) return null;

    let content = <span role="status">Loading entries…</span>;

    if (result._tag === "Failure") {
      content = (
        <>
          <span role="alert">{failureMessage(result.cause)}</span>
          {canRetryFailure(result.cause) && (
            <Button appearance="soft" size="sm" onClick={refresh} disabled={result.waiting}>
              Retry
            </Button>
          )}
        </>
      );
    }

    return (
      <div
        {...stylex.props(typography.label, styles.row(first.start), styles.status)}
        role="listitem"
      >
        {content}
      </div>
    );
  }

  return items.map((item) => {
    const entry = result.value.items[item.index - offset];

    if (!entry) return null;

    return (
      <div
        key={entry.name}
        {...stylex.props(styles.row(item.start))}
        role="listitem"
        aria-posinset={item.index + 1}
        aria-setsize={total}
      >
        <FileRow entry={entry} />
      </div>
    );
  });
}

const styles = stylex.create({
  viewport: {
    flexGrow: 1,
    minHeight: 0,
    overflow: "auto",
    scrollbarGutter: "stable",
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
  status: {
    display: "flex",
    gap: space[3],
    paddingInline: space[6],
    color: colors.textMuted,
  },
  empty: { padding: space[6], color: colors.textMuted, flexGrow: 1 },
  footer: {
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
