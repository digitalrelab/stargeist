import { Select as BaseSelect } from "@base-ui/react/select";
import * as stylex from "@stylexjs/stylex";
import { Button } from "../button";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "../icons";
import { colors, control, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export interface SelectProps<Value extends string> {
  readonly items: ReadonlyArray<{ readonly value: Value; readonly label: string }>;
  readonly value: Value | undefined;
  readonly onValueChange: (value: Value) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly "aria-label": string;
  readonly "aria-busy"?: boolean;
}

export function Select<Value extends string>({
  items,
  value,
  onValueChange,
  placeholder = "Select…",
  disabled,
  ...props
}: SelectProps<Value>) {
  const selected = items.find((item) => item.value === value);

  return (
    <BaseSelect.Root<Value>
      items={items}
      value={selected?.value ?? null}
      disabled={disabled || items.length === 0}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
    >
      <BaseSelect.Trigger {...props} render={<Button appearance="soft" styles={styles.trigger} />}>
        <BaseSelect.Value
          {...stylex.props(styles.label)}
          placeholder={placeholder}
          title={selected?.label}
        />
        <BaseSelect.Icon {...stylex.props(styles.indicator)}>
          <ChevronsUpDownIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger
          sideOffset={4}
          {...stylex.props(styles.positioner)}
        >
          <BaseSelect.Popup {...stylex.props(styles.popup, typography.label)}>
            <BaseSelect.ScrollUpArrow {...stylex.props(styles.scrollArrow, styles.scrollUp)}>
              <ChevronUpIcon />
            </BaseSelect.ScrollUpArrow>
            <BaseSelect.List {...stylex.props(styles.list)}>
              {items.map((item) => (
                <BaseSelect.Item key={item.value} value={item.value} {...stylex.props(styles.item)}>
                  <BaseSelect.ItemText {...stylex.props(styles.label)} title={item.label}>
                    {item.label}
                  </BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator {...stylex.props(styles.indicator)}>
                    <CheckIcon />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
            <BaseSelect.ScrollDownArrow {...stylex.props(styles.scrollArrow, styles.scrollDown)}>
              <ChevronDownIcon />
            </BaseSelect.ScrollDownArrow>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
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
    gridTemplateColumns: `minmax(0, 1fr) ${control.iconSize}`,
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
