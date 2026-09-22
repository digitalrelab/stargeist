import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import * as stylex from "@stylexjs/stylex";
import { CheckIcon, MinusIcon } from "../icons";
import { colors, control, focusRing, radii, space } from "../tokens.stylex";

function Root({ children, ...props }: Omit<BaseCheckbox.Root.Props, "className" | "style">) {
  return (
    <BaseCheckbox.Root {...props} {...stylex.props(stylex.defaultMarker(), styles.root)}>
      <span {...stylex.props(styles.control)}>{children}</span>
    </BaseCheckbox.Root>
  );
}

function Indicator(
  props: Omit<BaseCheckbox.Indicator.Props, "className" | "style" | "render" | "children">,
) {
  return (
    <BaseCheckbox.Indicator
      {...props}
      {...stylex.props(styles.indicator)}
      render={(elementProps, state) => {
        let Icon = CheckIcon;

        if (state.indeterminate) {
          Icon = MinusIcon;
        }

        return (
          <span {...elementProps}>
            <Icon size={space[3]} aria-hidden="true" />
          </span>
        );
      }}
    />
  );
}

export const Checkbox = { Root, Indicator };

const styles = stylex.create({
  root: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    minWidth: `calc(${control.iconSize} + ${space[2]})`,
    minHeight: `calc(${control.iconSize} + ${space[2]})`,
    padding: space[1],
    borderWidth: 0,
    backgroundColor: "transparent",
    outlineStyle: "none",
    color: { default: colors.text, "[data-disabled]": colors.onControlDisabled },
    opacity: { default: 1, "[data-disabled]": 0.5 },
  },
  control: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: control.iconSize,
    height: control.iconSize,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: colors.borderStrong,
      [stylex.when.ancestor(':is([role="checkbox"]):hover:not([data-disabled])')]: colors.textMuted,
    },
    borderRadius: radii.sm,
    backgroundColor: {
      default: "transparent",
      [stylex.when.ancestor(":is([data-checked], [data-indeterminate])")]: colors.controlPressed,
    },
    outlineColor: colors.focusRing,
    outlineWidth: focusRing.width,
    outlineOffset: focusRing.offset,
    outlineStyle: {
      default: "none",
      [stylex.when.ancestor(':is([role="checkbox"]):focus-visible')]: "solid",
    },
  },
  indicator: {
    display: { default: "flex", "[data-unchecked]": "none" },
    alignItems: "center",
    justifyContent: "center",
  },
});
