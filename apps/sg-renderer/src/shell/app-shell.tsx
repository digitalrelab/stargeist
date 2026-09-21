import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import * as WorkArea from "./work-area";

export function AppShell({
  primarySidebar,
  secondarySidebar,
  children,
  ...props
}: Omit<ComponentProps<"div">, "className" | "style"> & {
  primarySidebar: ReactNode;
  secondarySidebar?: ReactNode;
}) {
  return (
    <div {...props} {...stylex.props(styles.frame)}>
      <div {...stylex.props(styles.primarySidebar)}>{primarySidebar}</div>
      <div {...stylex.props(styles.content, !!secondarySidebar && styles.withSecondarySidebar)}>
        <WorkArea.Root>{children}</WorkArea.Root>
        {secondarySidebar}
      </div>
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
  primarySidebar: {
    display: { default: "grid", "@media (max-width: 480px)": "block" },
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    maxHeight: { default: "none", "@media (max-width: 480px)": "30dvh" },
    overflow: { default: "hidden", "@media (max-width: 480px)": "auto" },
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    columnGap: { default: space[2], "@media (max-width: 640px)": space[1] },
  },
  withSecondarySidebar: {
    gridTemplateColumns: "minmax(0, 1fr) min(20rem, 35vw)",
  },
});
