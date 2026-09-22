import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, ScrollArea, typography } from "@stargeist/ui";
import { colors, radii, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { defaultRangeExtractor, useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import { useEffect } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { FileListContext, useFileList, useFileListContext } from "./context";
import { layout, rowHeight } from "./layout";
import { FileNameSkeleton } from "./loading";
import { FileRow } from "./row";
import { useFileBrowserContext } from "../file-browser";

export function FileList() {
  const list = useFileList();
  const { listing } = useFileBrowserContext();
  const { gridId, active, column } = list;
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
    scrollPaddingEnd: 8,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);

      if (active !== undefined && active < count && !indexes.includes(active)) {
        if (active < range.startIndex) {
          indexes.unshift(active);
        } else {
          indexes.push(active);
        }
      }

      return indexes;
    },
  });

  useEffect(() => {
    if (active !== undefined) {
      virtualizer.scrollToIndex(active, { align: "auto" });
    }
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

  return (
    <FileListContext value={list}>
      <ScrollArea.Root>
        <ScrollArea.Viewport
          {...list.viewportProps}
          render={<div {...stylex.props(stylex.defaultMarker())} />}
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
    </FileListContext>
  );
}

function PageRows({ offset, items }: { offset: number; items: VirtualItem[] }) {
  const { gridId, active } = useFileListContext();
  const { listing, selection, dispatch } = useFileBrowserContext();
  const atom = listing.pages(offset);
  const result = useAtomValue(atom);
  const request = useAtomValue(selection.request);
  const refresh = useAtomRefresh(atom);

  if (result._tag === "Initial") {
    return items.map((item) => (
      <div
        key={item.index}
        {...stylex.props(
          styles.row(item.start),
          layout.row,
          item.index === active && styles.activeStatus,
        )}
        role="row"
        aria-rowindex={item.index + 1}
        aria-busy="true"
      >
        <span role="gridcell" id={`${gridId}-${item.index}-0`} />
        <div
          role="gridcell"
          id={`${gridId}-${item.index}-1`}
          aria-label="Loading file"
          {...stylex.props(layout.nameCell, layout.name)}
        >
          <FileNameSkeleton />
        </div>
      </div>
    ));
  }

  if (result._tag === "Failure") {
    const first = items.find((item) => item.index === active) ?? items[0];

    if (!first) {
      return null;
    }

    let retry = refresh;

    if (
      request._tag === "Failure" &&
      active !== undefined &&
      listing.pageOffset(active) === offset
    ) {
      retry = () => dispatch({ type: "retry" });
    }

    return (
      <div
        {...stylex.props(
          typography.label,
          styles.row(first.start),
          styles.status,
          first.index === active && styles.activeStatus,
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
          <span role="alert">{failureMessage(result.cause)}</span>
          {canRetryFailure(result.cause) && (
            <Button appearance="soft" onClick={retry} disabled={result.waiting}>
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return items.map((item) => {
    const entry = result.value.items[item.index - offset];

    if (!entry) {
      return null;
    }

    return (
      <div key={entry.name} {...stylex.props(styles.row(item.start))}>
        <FileRow entry={entry} index={item.index} />
      </div>
    );
  });
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
    backgroundColor: {
      [stylex.when.ancestor(':is([role="grid"]):focus-visible')]: colors.controlPressed,
    },
    borderRadius: radii.md,
    outlineColor: "Highlight",
    outlineWidth: 1,
    outlineOffset: -1,
    outlineStyle: {
      default: "none",
      "@media (forced-colors: active)": {
        [stylex.when.ancestor(':is([role="grid"]):focus-visible')]: "solid",
      },
    },
  },
});
