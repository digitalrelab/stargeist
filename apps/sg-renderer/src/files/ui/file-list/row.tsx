import { useAtomValue } from "@effect/atom-react";
import { Selection } from "@stargeist/std/selection/react";
import type { FileSystemEntry } from "@stargeist/domain";
import { Checkbox, typography } from "@stargeist/ui";
import { colors, focusRing, fonts, radii } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useCallback } from "react";
import { FileKind } from "../file-kind";
import { useFileListContext } from "./context";
import { layout } from "./layout";

export function FileRow({ entry, index }: { entry: FileSystemEntry; index: number }) {
  const list = useFileListContext();
  const selected = Selection.useSelected(list.selection, entry.name);
  const matchesEntry = useCallback((name: string | undefined) => name === entry.name, [entry.name]);
  const inspected = useAtomValue(list.inspectedName, matchesEntry);
  const active = index === list.active;
  const id = `${list.gridId}-${index}`;

  return (
    <div
      {...list.rowProps}
      {...stylex.props(stylex.defaultMarker(), layout.row, styles.row)}
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      data-selected={selected}
      data-inspected={inspected}
      data-active={active}
      onClick={(event) => {
        if (event.shiftKey) {
          list.extend(index, 1);
        } else if (event.metaKey || event.ctrlKey) {
          list.toggle(index, entry);
        } else {
          list.inspect(index, entry);
        }
      }}
    >
      <span {...stylex.props(styles.selection)} role="gridcell" id={`${id}-0`}>
        <Checkbox.Root
          tabIndex={-1}
          checked={selected}
          aria-label={`Select ${entry.name}`}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(_checked, details) => {
            if ("shiftKey" in details.event && details.event.shiftKey) {
              details.cancel();
              list.extend(index, 0);

              return;
            }

            list.toggle(index, entry);
          }}
        >
          <Checkbox.Indicator />
        </Checkbox.Root>
      </span>
      <span role="gridcell" id={`${id}-1`} {...stylex.props(layout.nameCell)}>
        <button
          type="button"
          {...stylex.props(typography.label, layout.name, styles.action)}
          tabIndex={-1}
        >
          <FileKind.Icon kind={entry.kind} />
          <span {...stylex.props(styles.name)}>{entry.name}</span>
        </button>
      </span>
    </div>
  );
}

const styles = stylex.create({
  row: {
    position: "relative",
    isolation: "isolate",
    "::before": {
      content: '""',
      position: "absolute",
      insetBlock: 1,
      insetInline: 0,
      zIndex: -1,
      pointerEvents: "none",
      borderRadius: radii.md,
      backgroundColor: {
        default: "transparent",
        ":hover": colors.surfaceRaised,
        ':is([data-selected="true"], [data-inspected="true"])': {
          default: `color-mix(in srgb, ${colors.text} 6%, transparent)`,
          ":hover": `color-mix(in srgb, ${colors.text} 8%, transparent)`,
        },
        '[data-active="true"]': {
          [stylex.when.ancestor(':is([role="grid"]):focus-visible')]:
            `color-mix(in srgb, ${colors.text} 10%, transparent)`,
        },
      },
    },
    outlineColor: "Highlight",
    outlineWidth: 1,
    outlineOffset: -1,
    outlineStyle: {
      default: "none",
      "@media (forced-colors: active)": {
        '[data-active="true"]': {
          [stylex.when.ancestor(':is([role="grid"]):focus-visible')]: "solid",
        },
      },
    },
  },
  selection: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    height: "100%",
    opacity: {
      default: 0,
      [stylex.when.ancestor(':is([role="row"]):is(:hover, :focus-within, [data-selected="true"])')]:
        1,
      [stylex.when.ancestor(':is([role="grid"]):focus-visible')]: {
        [stylex.when.ancestor(':is([role="row"])[data-active="true"]')]: 1,
      },
      "@media (hover: none)": 1,
    },
  },
  action: {
    padding: 0,
    appearance: "none",
    borderWidth: 0,
    borderRadius: radii.sm,
    textAlign: "start",
    backgroundColor: "transparent",
    outlineColor: colors.borderStrong,
    outlineWidth: focusRing.width,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    fontWeight: fonts.regular,
  },
  name: { color: colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
});
