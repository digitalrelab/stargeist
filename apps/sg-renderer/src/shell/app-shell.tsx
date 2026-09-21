import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import * as WorkArea from "./work-area";

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.frame)}>
      <div {...stylex.props(styles.sidebar)}>{sidebar}</div>
      <WorkArea.Root>{children}</WorkArea.Root>
    </div>
  );
}

const styles = stylex.create({
  frame: {
    display: "grid",
    gridTemplateColumns: {
      default: "240px minmax(0, 1fr)",
      "@media (max-width: 640px)": "160px minmax(0, 1fr)",
      "@media (max-width: 480px)": "minmax(0, 1fr)",
    },
    gridTemplateRows: {
      default: "minmax(0, 1fr)",
      "@media (max-width: 480px)": "auto minmax(0, 1fr)",
    },
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
  sidebar: {
    display: { default: "grid", "@media (max-width: 480px)": "block" },
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    maxHeight: { default: "none", "@media (max-width: 480px)": "30dvh" },
    overflow: { default: "hidden", "@media (max-width: 480px)": "auto" },
  },
});
