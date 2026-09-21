import { Select as BaseSelect } from "@base-ui/react/select";
import * as stylex from "@stylexjs/stylex";
import { Button } from "../button";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "../icons";
import { colors, control, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export const Root = BaseSelect.Root;

export function Trigger({
  children,
  ...props
}: Omit<BaseSelect.Trigger.Props, "className" | "style" | "render" | "nativeButton">) {
  return (
    <BaseSelect.Trigger {...props} render={<Button appearance="soft" styles={styles.trigger} />}>
      {children}
      <BaseSelect.Icon {...stylex.props(styles.indicator)}>
        <ChevronsUpDownIcon />
      </BaseSelect.Icon>
    </BaseSelect.Trigger>
  );
}

export function Value(props: Omit<BaseSelect.Value.Props, "className" | "style">) {
  return <BaseSelect.Value {...props} {...stylex.props(styles.label)} />;
}

export function Popup({ children, ...props }: Omit<BaseSelect.Popup.Props, "className" | "style">) {
  return (
    <BaseSelect.Portal>
      <BaseSelect.Positioner
        alignItemWithTrigger={false}
        align="start"
        sideOffset={4}
        {...stylex.props(styles.positioner)}
      >
        <BaseSelect.Popup {...props} {...stylex.props(styles.popup, typography.label)}>
          <BaseSelect.ScrollUpArrow {...stylex.props(styles.scrollArrow, styles.scrollUp)}>
            <ChevronUpIcon />
          </BaseSelect.ScrollUpArrow>
          <BaseSelect.List {...stylex.props(styles.list)}>{children}</BaseSelect.List>
          <BaseSelect.ScrollDownArrow {...stylex.props(styles.scrollArrow, styles.scrollDown)}>
            <ChevronDownIcon />
          </BaseSelect.ScrollDownArrow>
        </BaseSelect.Popup>
      </BaseSelect.Positioner>
    </BaseSelect.Portal>
  );
}

export function Item({ children, ...props }: Omit<BaseSelect.Item.Props, "className" | "style">) {
  return (
    <BaseSelect.Item {...props} {...stylex.props(styles.item)}>
      <BaseSelect.ItemIndicator {...stylex.props(styles.indicator, styles.itemIndicator)}>
        <CheckIcon />
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText {...stylex.props(styles.label, styles.itemLabel)}>
        {children}
      </BaseSelect.ItemText>
    </BaseSelect.Item>
  );
}

const styles = stylex.create({
  trigger: {
    minInlineSize: 0,
    inlineSize: "100%",
  },
  label: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "start",
  },
  indicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: control.iconSize,
    height: control.iconSize,
  },
  itemIndicator: { gridColumn: 1, gridRow: 1 },
  itemLabel: { gridColumn: 2, gridRow: 1 },
  positioner: {
    zIndex: 1,
  },
  popup: {
    position: "relative",
    width: "var(--anchor-width)",
    maxWidth: "var(--available-width)",
    maxHeight: "var(--available-height)",
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: control.radius,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    boxShadow: shadows.raised,
  },
  list: {
    maxHeight: "min(20rem, var(--available-height))",
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: space[1],
    scrollPaddingBlock: space[1],
  },
  scrollArrow: {
    position: "absolute",
    zIndex: 1,
    insetInline: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: control.heightSm,
    backgroundColor: colors.surfaceRaised,
  },
  scrollUp: { top: 0 },
  scrollDown: { bottom: 0 },
  item: {
    display: "grid",
    gridTemplateColumns: `${control.iconSize} minmax(0, 1fr)`,
    alignItems: "center",
    gap: space[2],
    minHeight: control.heightSm,
    paddingBlock: space[1],
    paddingInline: space[2],
    borderRadius: radii.sm,
    cursor: "default",
    outlineStyle: "none",
    backgroundColor: {
      default: "transparent",
      "[data-highlighted]": colors.controlHovered,
    },
  },
});
