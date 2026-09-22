import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { Button, type ButtonLinkProps } from "../button";
import { control, space } from "../tokens.stylex";

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

export function Link({
  icon,
  children,
  ...props
}: Omit<ButtonLinkProps, "appearance" | "size" | "shape" | "styles"> & { icon?: ReactNode }) {
  return (
    <Button.Link {...props} appearance="ghost" styles={styles.link}>
      {icon && (
        <span {...stylex.props(styles.icon)} aria-hidden="true">
          {icon}
        </span>
      )}
      <span {...stylex.props(styles.label)}>{children}</span>
    </Button.Link>
  );
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
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: control.iconSize,
    height: control.iconSize,
  },
  label: {
    flexGrow: 1,
    minWidth: 0,
    textAlign: "start",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  link: { flexShrink: 0 },
});
