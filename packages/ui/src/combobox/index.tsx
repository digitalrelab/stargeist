import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import * as stylex from "@stylexjs/stylex";
import { CheckIcon } from "../icons";
import { colors, control, fonts, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export const Root = BaseCombobox.Root;
export const Trigger = BaseCombobox.Trigger;
export const Value = BaseCombobox.Value;
export const useFilteredItems = BaseCombobox.useFilteredItems;

type Sizing = Partial<
  Pick<stylex.CSSProperties, "inlineSize" | "blockSize" | "minInlineSize" | "maxBlockSize">
>;
type Positioning = Partial<
  Pick<
    stylex.CSSProperties,
    "position" | "insetBlockStart" | "insetInline" | "transform" | "blockSize"
  >
>;

export function Popup({
  styles: customStyles,
  ...props
}: Omit<BaseCombobox.Popup.Props, "className" | "style"> & {
  styles?: stylex.StyleXStyles<Sizing>;
}) {
  return (
    <BaseCombobox.Portal>
      <BaseCombobox.Positioner align="start" sideOffset={4} {...stylex.props(styles.positioner)}>
        <BaseCombobox.Popup {...props} {...stylex.props(styles.popup, customStyles)} />
      </BaseCombobox.Positioner>
    </BaseCombobox.Portal>
  );
}

export function Input(props: Omit<BaseCombobox.Input.Props, "className" | "style">) {
  return <BaseCombobox.Input {...props} {...stylex.props(typography.body, styles.input)} />;
}

export function List({
  styles: customStyles,
  ...props
}: Omit<BaseCombobox.List.Props, "className" | "style"> & {
  styles?: stylex.StyleXStyles<Sizing>;
}) {
  return <BaseCombobox.List {...props} {...stylex.props(styles.list, customStyles)} />;
}

export function Item({
  children,
  styles: customStyles,
  ...props
}: Omit<BaseCombobox.Item.Props, "className" | "style"> & {
  styles?: stylex.StyleXStyles<Positioning>;
}) {
  return (
    <BaseCombobox.Item {...props} {...stylex.props(typography.label, styles.item, customStyles)}>
      <BaseCombobox.ItemIndicator {...stylex.props(styles.indicator)}>
        <CheckIcon />
      </BaseCombobox.ItemIndicator>
      <span {...stylex.props(styles.content)}>{children}</span>
    </BaseCombobox.Item>
  );
}

export function Empty(props: Omit<BaseCombobox.Empty.Props, "className" | "style">) {
  return <BaseCombobox.Empty {...props} {...stylex.props(typography.label, styles.empty)} />;
}

const styles = stylex.create({
  positioner: { zIndex: 1 },
  popup: {
    maxInlineSize: "var(--available-width)",
    maxBlockSize: "var(--available-height)",
    overflow: "hidden",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: control.radius,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    boxShadow: shadows.raised,
  },
  input: {
    inlineSize: "100%",
    minInlineSize: 0,
    minBlockSize: control.heightMd,
    paddingBlock: space[2],
    paddingInline: space[3],
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomStyle: "solid",
    borderBottomColor: colors.divider,
    backgroundColor: "transparent",
    color: colors.text,
    outlineStyle: "none",
    "::placeholder": { color: colors.textPlaceholder, opacity: 1 },
  },
  empty: {
    display: { default: "block", ":empty": "none" },
    padding: space[5],
    color: colors.textMuted,
    fontWeight: fonts.regular,
  },
  list: { position: "relative", inlineSize: "100%", minInlineSize: 0 },
  item: {
    display: "grid",
    gridTemplateColumns: `${control.iconSize} minmax(0, 1fr)`,
    alignItems: "start",
    gap: space[2],
    minInlineSize: 0,
    minBlockSize: control.heightMd,
    padding: space[2],
    borderRadius: radii.sm,
    backgroundColor: { default: "transparent", "[data-highlighted]": colors.controlHovered },
    color: colors.text,
    cursor: "default",
    outlineStyle: "none",
  },
  indicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gridColumn: 1,
    gridRow: 1,
    inlineSize: control.iconSize,
    blockSize: control.iconSize,
    marginBlockStart: space[0.5],
  },
  content: { display: "block", gridColumn: 2, gridRow: 1, inlineSize: "100%", minInlineSize: 0 },
});
