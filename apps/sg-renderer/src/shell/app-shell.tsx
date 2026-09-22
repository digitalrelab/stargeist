import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"div">, "className" | "style">;

function Root(props: Props) {
  return <div {...props} {...stylex.props(styles.root)} />;
}

function Navigation(props: Props) {
  return <div {...props} {...stylex.props(styles.navigation)} />;
}

export const AppShell = { Root, Navigation };

const styles = stylex.create({
  root: {
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
    paddingInlineEnd: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
    },
    backgroundColor: colors.canvas,
    overflow: "hidden",
  },
  navigation: {
    display: { default: "grid", "@media (max-width: 480px)": "block" },
    paddingTop: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
    },
    paddingBottom: {
      default: space[2],
      "@media (max-width: 640px)": space[1],
      "@media (max-width: 480px)": 0,
    },
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
    minWidth: 0,
    minHeight: 0,
    maxHeight: { default: "none", "@media (max-width: 480px)": "30dvh" },
    overflow: { default: "hidden", "@media (max-width: 480px)": "auto" },
  },
});
