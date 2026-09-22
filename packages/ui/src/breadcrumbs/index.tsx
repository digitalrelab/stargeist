import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { ChevronRightIcon } from "../icons";
import { colors, control, focusRing, space } from "../tokens.stylex";
import { typography } from "../typography";

type Props<T extends "nav" | "span" | "h1"> = Omit<ComponentProps<T>, "className" | "style">;

export function Root({ children, ...props }: Props<"nav">) {
  return (
    <nav aria-label="Breadcrumb" {...props} {...stylex.props(styles.navigation)}>
      <ol {...stylex.props(styles.root)}>{children}</ol>
    </nav>
  );
}

export function Link({
  render,
  ref,
  ...props
}: Omit<useRender.ComponentProps<"a">, "className" | "style">) {
  const link = useRender({
    defaultTagName: "a",
    render,
    ref,
    props: mergeProps<"a">(props, stylex.props(typography.label, styles.chip, styles.link)),
  });

  return (
    <li {...stylex.props(styles.item)}>
      {link}
      <Separator />
    </li>
  );
}

export function Label({ children, ...props }: Props<"span">) {
  return (
    <li {...stylex.props(styles.item)}>
      <span {...props} {...stylex.props(typography.label, styles.chip)}>
        {children}
      </span>
      <Separator />
    </li>
  );
}

export function Current({ children, ...props }: Props<"h1">) {
  return (
    <li {...stylex.props(styles.item)}>
      <h1
        {...props}
        aria-current="page"
        {...stylex.props(typography.label, styles.chip, styles.current)}
      >
        {children}
      </h1>
    </li>
  );
}

function Separator() {
  return (
    <span {...stylex.props(styles.separator)} aria-hidden="true">
      <ChevronRightIcon />
    </span>
  );
}

const styles = stylex.create({
  navigation: {
    minWidth: 0,
    maxWidth: "100%",
  },
  root: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  item: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },
  link: {
    backgroundColor: {
      default: colors.controlOutlined,
      ":hover": colors.controlOutlinedHovered,
      ":active": colors.controlOutlinedPressed,
    },
    color: {
      default: colors.onControlMuted,
      ":hover": colors.onControl,
      ":active": colors.onControl,
    },
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.border}`,
      ":hover": `inset 0 0 0 1px ${colors.borderStrong}`,
      ":active": `inset 0 0 0 1px ${colors.borderStrong}`,
    },
    textDecoration: "none",
    outlineColor: colors.focusRing,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    minWidth: 0,
    maxWidth: "100%",
    blockSize: control.heightXs,
    paddingInline: space[2],
    borderRadius: control.radius,
    backgroundColor: colors.controlOutlined,
    color: colors.onControlMuted,
    boxShadow: `inset 0 0 0 1px ${colors.border}`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  current: {
    color: colors.onControl,
  },
  separator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginInline: space[1],
    color: colors.statusNeutral,
  },
});
