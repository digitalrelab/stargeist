import { Button as BaseButton } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { colors, control, focusRing, fonts, space } from "../tokens.stylex";
import { typography } from "../typography";

type ButtonStyleProps = {
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

export type ButtonProps = Omit<BaseButton.Props, "className" | "style"> & ButtonStyleProps;

export type ButtonLinkProps = Omit<useRender.ComponentProps<"a">, "className" | "style"> &
  ButtonStyleProps;

function ButtonRoot({ appearance, size, styles: customStyles, ...props }: ButtonProps) {
  return (
    <BaseButton {...mergeProps<"button">(props, buttonStyles(appearance, size, customStyles))} />
  );
}

function ButtonLink({
  appearance,
  size,
  styles: customStyles,
  render,
  ref,
  ...props
}: ButtonLinkProps) {
  return useRender({
    defaultTagName: "a",
    render,
    ref,
    props: mergeProps<"a">(props, buttonStyles(appearance, size, customStyles)),
  });
}

export const Button = Object.assign(ButtonRoot, { Link: ButtonLink });

function buttonStyles(
  appearance: ButtonStyleProps["appearance"] = "solid",
  size: ButtonStyleProps["size"] = "md",
  customStyles?: ButtonStyleProps["styles"],
) {
  return stylex.props(
    typography.label,
    styles.button,
    sizes[size],
    appearances[appearance],
    customStyles,
  );
}

const styles = stylex.create({
  button: {
    alignItems: "center",
    appearance: "none",
    borderWidth: 0,
    borderRadius: control.radius,
    display: "inline-flex",
    fontWeight: fonts.semibold,
    gap: space[2],
    justifyContent: "center",
    textDecoration: "none",
    outlineColor: colors.focusRing,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
});

const states = {
  hovered: ':hover:not(:active):not(:disabled):not([aria-disabled="true"])',
  pressed: ':active:not(:disabled):not([aria-disabled="true"])',
  interacting: ':is(:hover, :active):not(:disabled):not([aria-disabled="true"])',
  disabled: ':is(:disabled, [aria-disabled="true"])',
};

const appearances = stylex.create({
  solid: {
    backgroundColor: {
      default: colors.action,
      [states.hovered]: colors.actionHovered,
      [states.pressed]: colors.actionPressed,
      [states.disabled]: colors.controlDisabled,
    },
    color: {
      default: colors.onAction,
      [states.disabled]: colors.onControlDisabled,
    },
  },
  soft: {
    backgroundColor: {
      default: colors.control,
      [states.hovered]: colors.controlHovered,
      [states.pressed]: colors.controlPressed,
      [states.disabled]: colors.controlDisabled,
    },
    color: {
      default: colors.onControl,
      [states.disabled]: colors.onControlDisabled,
    },
  },
  ghost: {
    backgroundColor: {
      default: "oklch(0% 0 0 / 0)",
      [states.hovered]: colors.controlHovered,
      [states.pressed]: colors.controlPressed,
    },
    color: {
      default: colors.onControlMuted,
      [states.disabled]: colors.onControlDisabled,
      [states.interacting]: colors.onControl,
    },
  },
});

const sizes = stylex.create({
  icon: {
    inlineSize: control.heightMd,
    blockSize: control.heightMd,
    flexShrink: 0,
    padding: 0,
  },
  sm: {
    minHeight: control.heightSm,
    paddingBlock: space[1],
    paddingInline: space[3],
  },
  md: {
    minHeight: control.heightMd,
    paddingBlock: space[2],
    paddingInline: space[4],
  },
});
