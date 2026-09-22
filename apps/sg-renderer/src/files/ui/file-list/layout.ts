import { control, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

export const rowHeight = 42;

export const layout = stylex.create({
  row: {
    display: "grid",
    gridTemplateColumns: `calc(${space[2]} + ${space[6]} + ${space[3]}) minmax(0, 1fr)`,
    alignItems: "center",
    height: rowHeight,
  },
  nameCell: { gridColumn: 2, minWidth: 0, height: "100%", paddingInlineEnd: space[2] },
  name: {
    display: "grid",
    gridTemplateColumns: `${control.iconSize} minmax(0, 1fr)`,
    alignItems: "center",
    gap: space[3],
    minWidth: 0,
    height: "100%",
    width: "100%",
  },
});
