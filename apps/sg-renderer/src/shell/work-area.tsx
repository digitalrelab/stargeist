import { colors, radii, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";

type Props<T extends "div" | "main" | "header"> = Omit<ComponentProps<T>, "className" | "style">;

export function Root(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.root)} />;
}

export function Page(props: Props<"main">) {
  return <main {...props} {...stylex.props(styles.page)} />;
}

export function Header(props: Props<"header">) {
  return <header {...props} {...stylex.props(styles.header)} />;
}

export function Content(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.content)} />;
}

const styles = stylex.create({
  root: {
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
  page: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    flexShrink: 0,
    alignItems: "center",
    gap: space[4],
    paddingBlock: space[4],
    paddingInline: space[6],
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.borderSubtle,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
});
