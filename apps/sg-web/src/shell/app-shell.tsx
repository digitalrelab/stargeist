import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.frame)}>
      {sidebar}
      {children}
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
    height: "100dvh",
    overflow: "hidden",
  },
});
