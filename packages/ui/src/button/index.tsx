import { Button as BaseButton } from "@base-ui/react/button";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as stylex from "@stylexjs/stylex";
import { colors, control, focusRing, fonts, space } from "../tokens.stylex";
import { typography } from "../typography";

type ButtonLayout = Partial<
  Pick<
    stylex.CSSProperties,
    | "alignSelf"
    | "justifySelf"
    | "order"
    | "gridArea"
    | "gridColumn"
    | "gridRow"
    | "margin"
    | "marginBlock"
    | "marginBlockStart"
    | "marginBlockEnd"
    | "marginInline"
    | "marginInlineStart"
    | "marginInlineEnd"
  >
>;

type ButtonSizing = Partial<
  Pick<
    stylex.CSSProperties,
    "flexGrow" | "flexShrink" | "flexBasis" | "inlineSize" | "minInlineSize" | "maxInlineSize"
  >
>;

type ButtonStyleProps = {
  appearance?: keyof typeof appearances;
  size?: keyof typeof sizes;
} & (
  | { shape?: "rectangle"; styles?: stylex.StyleXStyles<ButtonLayout & ButtonSizing> }
  | { shape: "square"; styles?: stylex.StyleXStyles<ButtonLayout> }
);

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
  size: ButtonStyleProps["size"] = "sm",
  shape: ButtonStyleProps["shape"] = "rectangle",
  customStyles?: ButtonStyleProps["styles"],
) {
  return stylex.props(
    typography.label,
    styles.button,
    shape === "rectangle" && sizes[size],
    appearances[appearance],
    customStyles,
    shape === "square" && styles.square,
    shape === "square" && squareSizes[size],
  );
}

const styles = stylex.create({
  square: { padding: 0, flex: "none" },
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
  danger: {
    backgroundColor: {
      default: colors.danger,
      [states.hovered]: colors.dangerHovered,
      [states.pressed]: colors.dangerPressed,
      [states.disabled]: colors.controlDisabled,
    },
    color: {
      default: colors.onDanger,
      [states.disabled]: colors.onControlDisabled,
    },
  },
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
  sm: {
    minBlockSize: control.heightSm,
    paddingBlock: space[1],
    paddingInline: control.paddingInlineSm,
  },
  md: {
    minBlockSize: control.heightMd,
    paddingBlock: space[2],
    paddingInline: control.paddingInlineMd,
  },
});

const squareSizes = stylex.create({
  sm: { inlineSize: control.heightSm, blockSize: control.heightSm },
  md: { inlineSize: control.heightMd, blockSize: control.heightMd },
});
