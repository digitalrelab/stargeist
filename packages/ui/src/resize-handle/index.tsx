import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { EllipsisVerticalIcon } from "../icons";
import { colors, space } from "../tokens.stylex";

export type ResizeHandleProps = Omit<
  ComponentProps<"div">,
  "aria-orientation" | "children" | "className" | "role" | "style" | "tabIndex"
> & {
  orientation: "horizontal" | "vertical";
};

export function ResizeHandle({ orientation, ...props }: ResizeHandleProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      {...props}
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      data-orientation={orientation}
      data-resize-handle=""
      {...stylex.props(styles.root)}
    >
      <EllipsisVerticalIcon
        aria-hidden="true"
        focusable="false"
        {...stylex.props(styles.grip, isHorizontal && styles.horizontalGrip)}
      />
    </div>
  );
}

const styles = stylex.create({
  root: {
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: { default: space[3], '[data-orientation="horizontal"]': "auto" },
    height: { default: "auto", '[data-orientation="horizontal"]': space[3] },
    minWidth: 0,
    minHeight: 0,
    touchAction: "none",
    outline: "none",
    backgroundColor: {
      default: "transparent",
      ":hover": colors.controlHovered,
      ":focus-visible": colors.controlPressed,
      '[data-resizing=""]': colors.controlOutlinedPressed,
    },
    color: {
      default: colors.borderStrong,
      ":hover": colors.textMuted,
      ":focus-visible": colors.text,
      '[data-resizing=""]': colors.text,
    },
  },
  grip: {
    display: "block",
    flexShrink: 0,
    width: space[5],
    height: space[5],
    pointerEvents: "none",
  },
  horizontalGrip: { transform: "rotate(90deg)" },
});
