import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import * as stylex from "@stylexjs/stylex";
import { CheckIcon, MinusIcon } from "../icons";
import { colors, control, focusRing, radii, space } from "../tokens.stylex";

function Root(props: Omit<BaseCheckbox.Root.Props, "className" | "style">) {
  return <BaseCheckbox.Root {...props} {...stylex.props(styles.root)} />;
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
        if (state.indeterminate) Icon = MinusIcon;
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
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: control.iconSize,
    height: control.iconSize,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: { default: colors.borderStrong, ":hover:not([data-disabled])": colors.textMuted },
    borderRadius: radii.sm,
    backgroundColor: {
      default: "transparent",
      ":is([data-checked], [data-indeterminate])": `color-mix(in oklab, ${colors.text} 10%, transparent)`,
    },
    color: { default: colors.text, "[data-disabled]": colors.onControlDisabled },
    opacity: { default: 1, "[data-disabled]": 0.5 },
    outlineColor: colors.focusRing,
    outlineWidth: focusRing.width,
    outlineOffset: focusRing.offset,
    outlineStyle: { default: "none", ":focus-visible": "solid" },
    "::after": { content: '""', position: "absolute", inset: `calc(-1 * ${space[1]})` },
  },
  indicator: {
    display: { default: "flex", "[data-unchecked]": "none" },
    alignItems: "center",
    justifyContent: "center",
  },
});
