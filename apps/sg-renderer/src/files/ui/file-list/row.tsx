import { Selection } from "@stargeist/std/selection/react";
import type { FileSystemEntry } from "@stargeist/domain";
import { Checkbox, typography } from "@stargeist/ui";
import { colors, control, focusRing, fonts, radii, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { FileKind } from "../file-kind";
import { useFileListContext } from "./context";

export function FileRow({ entry, index }: { entry: FileSystemEntry; index: number }) {
  const list = useFileListContext();
  const selected = Selection.useSelected(list.selection, entry.name);
  const active = list.focused && index === list.active;
  const id = `${list.gridId}-${index}`;

  return (
    <div
      {...list.rowProps}
      {...stylex.props(
        stylex.defaultMarker(),
        styles.row,
        selected && styles.selected,
        active && styles.active,
      )}
      role="row"
      aria-rowindex={index + 1}
      aria-selected={selected}
      data-selected={selected}
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
      <span
        {...stylex.props(styles.selection)}
        role="gridcell"
        id={`${id}-0`}
        onClick={(event) => {
          event.stopPropagation();

          if (event.shiftKey) {
            list.extend(index, 0);
          } else {
            list.toggle(index, entry);
          }
        }}
      >
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
      <span role="gridcell" id={`${id}-1`} {...stylex.props(styles.nameCell)}>
        <button type="button" {...stylex.props(typography.label, styles.action)} tabIndex={-1}>
          <FileKind.Icon kind={entry.kind} />
          <span {...stylex.props(styles.name)}>{entry.name}</span>
        </button>
      </span>
    </div>
  );
}

const styles = stylex.create({
  row: {
    display: "grid",
    gridTemplateColumns: `calc(${space[2]} + ${space[6]} + ${space[3]}) minmax(0, 1fr)`,
    alignItems: "center",
    height: "100%",
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
      },
    },
  },
  selected: {
    "::before": {
      backgroundColor: {
        default: `color-mix(in srgb, ${colors.text} 6%, transparent)`,
        ":hover": `color-mix(in srgb, ${colors.text} 8%, transparent)`,
      },
    },
  },
  active: {
    "::before": {
      backgroundColor: {
        default: `color-mix(in srgb, ${colors.text} 10%, transparent)`,
        ":hover": `color-mix(in srgb, ${colors.text} 12%, transparent)`,
      },
    },
    outlineColor: "Highlight",
    outlineWidth: 1,
    outlineOffset: -1,
    outlineStyle: { default: "none", "@media (forced-colors: active)": "solid" },
  },
  selection: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingInlineStart: space[2],
    paddingInlineEnd: space[3],
    height: "100%",
    opacity: {
      default: 0,
      [stylex.when.ancestor(
        ':is(:hover, :focus-within, [data-selected="true"], [data-active="true"])',
      )]: 1,
      "@media (hover: none)": 1,
    },
  },
  nameCell: { minWidth: 0, height: "100%", paddingInlineEnd: space[2] },
  action: {
    display: "grid",
    gridTemplateColumns: `${control.iconSize} minmax(0, 1fr)`,
    alignItems: "center",
    gap: space[3],
    minWidth: 0,
    height: "100%",
    width: "100%",
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
