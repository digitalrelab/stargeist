import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { colors, fonts, radii, space } from "../tokens.stylex";
import { typography } from "../typography";

type Props<T extends "div" | "h3" | "li" | "p" | "ul"> = Omit<
  ComponentProps<T>,
  "className" | "style"
>;

export function Group(props: Props<"ul">) {
  return <ul {...props} {...stylex.props(styles.group)} />;
}

export function Root(props: Props<"li">) {
  return <li {...props} {...stylex.props(styles.root)} />;
}

export function Main(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.main)} />;
}

export function Media(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.media)} />;
}

export function Content(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.content)} />;
}

export function Title(props: Props<"h3">) {
  return <h3 {...props} {...stylex.props(typography.label, styles.title)} />;
}

export function Description(props: Props<"p">) {
  return <p {...props} {...stylex.props(typography.label, styles.description)} />;
}

export function Actions(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.actions)} />;
}

export function Aside(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.aside)} />;
}

const styles = stylex.create({
  group: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    listStyle: "none",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.divider,
    borderRadius: radii.lg,
  },
  root: {
    display: "grid",
    gridTemplateColumns: {
      default: "minmax(0, 1fr) auto",
      "@media (max-width: 640px)": "minmax(0, 1fr)",
    },
    alignItems: "center",
    columnGap: space[6],
    rowGap: space[4],
    minWidth: 0,
    padding: { default: space[5], "@media (max-width: 480px)": space[4] },
    borderBottomWidth: { default: 1, ":last-child": 0 },
    borderBottomStyle: "solid",
    borderBottomColor: colors.divider,
  },
  main: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    minWidth: 0,
  },
  media: { display: "flex", flex: "none" },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: space[0.5],
    minWidth: 0,
  },
  aside: {
    display: "flex",
    flexDirection: "column",
    alignItems: { default: "flex-end", "@media (max-width: 640px)": "flex-start" },
    gap: space[2],
    minWidth: 0,
  },
  title: { fontWeight: fonts.regular, overflowWrap: "anywhere" },
  description: { color: colors.textMuted, fontWeight: fonts.regular, overflowWrap: "anywhere" },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: { default: "flex-end", "@media (max-width: 640px)": "flex-start" },
    gap: space[2],
    minWidth: 0,
  },
});
