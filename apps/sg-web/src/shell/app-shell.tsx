import { colors } from "@stargeist/ui/colors.stylex";
import { radii, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.frame)}>
      {sidebar}
      <div {...stylex.props(styles.surface)}>{children}</div>
    </div>
  );
}

const styles = stylex.create({
  frame: {
    display: "grid",
    gridTemplateColumns: {
      default: "240px minmax(0, 1fr)",
      "@media (max-width: 640px)": "160px minmax(0, 1fr)",
    },
    gridTemplateRows: "minmax(0, 1fr)",
    height: "100dvh",
    paddingBlock: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
    },
    paddingInlineEnd: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
    },
    backgroundColor: colors.canvas,
    overflow: "hidden",
  },
  surface: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
});
