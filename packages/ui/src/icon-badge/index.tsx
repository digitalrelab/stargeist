import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { colors, control, radii } from "../tokens.stylex";

type IconBadgeProps = Omit<ComponentProps<"span">, "className" | "style">;

export function IconBadge(props: IconBadgeProps) {
  return <span {...props} {...stylex.props(styles.root)} />;
}

const styles = stylex.create({
  root: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    inlineSize: control.heightMd,
    blockSize: control.heightMd,
    flex: "none",
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    backgroundColor: colors.control,
    color: colors.textMuted,
  },
});
