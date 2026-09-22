import { Button as BaseButton } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { colors, control, focusRing, fonts, radii, space } from "../tokens.stylex";
import { typography } from "../typography";

type ButtonStyleProps = {
  appearance?: keyof typeof appearances;
  size?: keyof typeof sizes;
  shape?: keyof typeof shapes;
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

function ButtonRoot({ appearance, size, shape, styles: customStyles, ...props }: ButtonProps) {
  return (
    <BaseButton
      {...mergeProps<"button">(props, buttonStyles(appearance, size, shape, customStyles))}
    />
  );
}

function ButtonLink({
  appearance,
  size,
  shape,
  styles: customStyles,
  render,
  ref,
  ...props
}: ButtonLinkProps) {
  return useRender({
    defaultTagName: "a",
    render,
    ref,
    props: mergeProps<"a">(props, buttonStyles(appearance, size, shape, customStyles)),
  });
}

export const Button = Object.assign(ButtonRoot, { Link: ButtonLink });

function buttonStyles(
  appearance: ButtonStyleProps["appearance"] = "solid",
  size: ButtonStyleProps["size"] = "md",
  shape: ButtonStyleProps["shape"] = "default",
  customStyles?: ButtonStyleProps["styles"],
) {
  return stylex.props(
    typography.label,
    styles.button,
    sizes[size],
    appearances[appearance],
    shapes[shape],
    customStyles,
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
    textDecoration: "none",
    outlineColor: colors.focusRing,
    outlineOffset: `calc(-1 * ${focusRing.width})`,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    outlineWidth: focusRing.width,
  },
});

const states = {
  hovered: ':hover:not(:active):not([data-popup-open]):not(:disabled):not([aria-disabled="true"])',
  pressed: ':is(:active, [data-popup-open]):not(:disabled):not([aria-disabled="true"])',
  interacting: ':is(:hover, :active, [data-popup-open]):not(:disabled):not([aria-disabled="true"])',
  disabled: ':is(:disabled, [aria-disabled="true"])',
  current:
    '[aria-current="page"]:not(:hover):not(:active):not([data-popup-open]):not(:disabled):not([aria-disabled="true"])',
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
      [states.current]: colors.controlSelected,
      [states.hovered]: colors.controlHovered,
      [states.pressed]: colors.controlPressed,
    },
    color: {
      default: colors.onControlMuted,
      [states.current]: colors.onControl,
      [states.disabled]: colors.onControlDisabled,
      [states.interacting]: colors.onControl,
    },
  },
});

const sizes = stylex.create({
  iconSm: {
    inlineSize: control.heightSm,
    blockSize: control.heightSm,
    flexShrink: 0,
    padding: 0,
  },
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
    paddingInline: control.paddingInlineMd,
  },
});

const shapes = stylex.create({
  default: { borderRadius: control.radius },
  pill: { borderRadius: radii.full },
});
