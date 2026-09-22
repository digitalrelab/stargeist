import { typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { surface } from "./surface";

type Props<T extends "div" | "main" | "header" | "h1"> = Omit<
  ComponentProps<T>,
  "className" | "style"
>;

export function Root(props: Props<"div">) {
  return <div {...props} {...stylex.props(surface.root, styles.root)} />;
}

export function Page(props: Props<"main">) {
  return <main {...props} {...stylex.props(styles.page)} />;
}

export function Header(props: Props<"header">) {
  return <header {...props} {...stylex.props(styles.header)} />;
}

export function Title(props: Props<"h1">) {
  return <h1 {...props} {...stylex.props(typography.body, styles.title)} />;
}

export function Content(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.content)} />;
}

export function Body(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.body)} />;
}

export function Container(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.container)} />;
}

const styles = stylex.create({
  root: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateRows: "minmax(0, 1fr)",
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
  title: { fontWeight: fonts.semibold },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  body: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
  },
  container: {
    width: "100%",
    maxWidth: "800px",
    marginInline: "auto",
    paddingBlock: space[8],
    paddingInline: { default: space[6], "@media (max-width: 480px)": space[4] },
  },
});
