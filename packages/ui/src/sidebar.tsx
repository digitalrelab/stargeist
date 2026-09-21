import { Role, type RoleProps } from "@ariakit/react";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { colors } from "./colors.stylex";
import { focusRing, radii, space } from "./tokens.stylex";
import { typography } from "./typography";

type Props<T extends "aside" | "div" | "nav"> = Omit<ComponentProps<T>, "className" | "style">;

export function Root(props: Props<"aside">) {
  return <aside {...props} {...stylex.props(styles.sidebar)} />;
}

export function Header(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.header)} />;
}

export function Content(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.content)} />;
}

export function Nav(props: Props<"nav">) {
  return <nav {...props} {...stylex.props(styles.navigation)} />;
}

export function Footer(props: Props<"div">) {
  return <div {...props} {...stylex.props(styles.footer)} />;
}

export function Link(props: Omit<RoleProps<"a">, "className" | "style">) {
  return <Role.a {...props} {...stylex.props(styles.link, typography.label)} />;
}

const styles = stylex.create({
  sidebar: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    gap: space[4],
    padding: space[4],
  },
  header: { display: "flex", flexDirection: "column", gap: space[4], flexShrink: 0 },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: space[4],
    overflowY: "auto",
    minHeight: 0,
  },
  navigation: { display: "flex", flexDirection: "column", gap: space[1] },
  footer: { display: "flex", flexDirection: "column", gap: space[1], flexShrink: 0 },
  link: {
    display: "block",
    flexShrink: 0,
    minHeight: 40,
    alignContent: "center",
    borderRadius: radii.md,
    paddingInline: space[3],
    color: colors.textMuted,
    textDecoration: "none",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    backgroundColor: {
      default: "oklch(0% 0 0 / 0)",
      ":hover": colors.controlHovered,
      '[aria-current="page"]': colors.control,
    },
    outlineColor: colors.focusRing,
    outlineWidth: focusRing.width,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineOffset: focusRing.offset,
  },
});
