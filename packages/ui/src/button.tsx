import { Button as AriakitButton, type ButtonProps as AriakitButtonProps } from "@ariakit/react";
import * as stylex from "@stylexjs/stylex";
import { colors } from "./colors.stylex";
import { controlHeight, focusRing, fonts, radii, space } from "./tokens.stylex";
import { typography } from "./typography";

export type ButtonProps = Omit<AriakitButtonProps, "className" | "style"> & {
  appearance?: keyof typeof appearances;
  size?: keyof typeof sizes;
  styles?: stylex.StyleXStyles<
    Partial<
      Pick<
        stylex.CSSProperties,
        | "alignSelf"
        | "justifySelf"
        | "flexGrow"
        | "flexShrink"
        | "flexBasis"
        | "order"
        | "gridArea"
        | "gridColumn"
        | "gridRow"
        | "inlineSize"
        | "minInlineSize"
        | "maxInlineSize"
        | "margin"
        | "marginBlock"
        | "marginBlockStart"
        | "marginBlockEnd"
        | "marginInline"
        | "marginInlineStart"
        | "marginInlineEnd"
      >
    >
  >;
};

export function Button({
  appearance = "solid",
  size = "md",
  styles: customStyles,
  ...props
}: ButtonProps) {
  const disabled =
    props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";

  return (
    <AriakitButton
      {...props}
      {...stylex.props(
        typography.label,
        styles.button,
        sizes[size],
        disabled ? styles.disabled : appearances[appearance],
        customStyles,
      )}
    />
  );
}

const styles = stylex.create({
  button: {
    alignItems: "center",
    appearance: "none",
    borderWidth: 0,
    display: "inline-flex",
    fontWeight: fonts.semibold,
    gap: space[2],
    justifyContent: "center",
    outlineColor: colors.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":is(:focus-visible, [data-focus-visible])": "solid" },
    outlineWidth: focusRing.width,
  },
  disabled: {
    backgroundColor: colors.controlDisabled,
    color: colors.textDisabled,
  },
});

const appearances = stylex.create({
  solid: {
    backgroundColor: {
      default: colors.action,
      ":hover:not(:active):not([data-active])": colors.actionHovered,
      ":is(:active, [data-active])": colors.actionPressed,
    },
    color: colors.onAction,
  },
  soft: {
    backgroundColor: {
      default: colors.control,
      ":hover:not(:active):not([data-active])": colors.controlHovered,
      ":is(:active, [data-active])": colors.controlPressed,
    },
    color: colors.text,
  },
  ghost: {
    backgroundColor: {
      default: "oklch(0% 0 0 / 0)",
      ":hover:not(:active):not([data-active])": colors.controlHovered,
      ":is(:active, [data-active])": colors.controlPressed,
    },
    color: colors.text,
  },
});

const sizes = stylex.create({
  sm: {
    borderRadius: radii.md,
    minHeight: controlHeight.sm,
    paddingBlock: space[1],
    paddingInline: space[3],
  },
  md: {
    borderRadius: radii.lg,
    minHeight: controlHeight.md,
    paddingBlock: space[2],
    paddingInline: space[4],
  },
});
