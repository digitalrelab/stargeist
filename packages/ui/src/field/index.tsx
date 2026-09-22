import { Field as BaseField } from "@base-ui/react/field";
import * as stylex from "@stylexjs/stylex";
import { createContext, useContext, type ComponentProps } from "react";
import { colors, control, fonts, space } from "../tokens.stylex";
import { typography } from "../typography";

type RootProps = Omit<BaseField.Root.Props, "className" | "style">;
type LabelProps = Omit<BaseField.Label.Props, "className" | "style">;
type ControlProps = Omit<BaseField.Control.Props, "className" | "style">;
type DescriptionProps = Omit<BaseField.Description.Props, "className" | "style">;
type ErrorProps = Omit<BaseField.Error.Props, "className" | "style"> & {
  visuallyHidden?: boolean;
};
type ControlGroupProps = Omit<ComponentProps<"div">, "className" | "style">;
type SuffixProps = Omit<ComponentProps<"div">, "className" | "style">;

const ControlGroupContext = createContext(false);

export function Root(props: RootProps) {
  return <BaseField.Root {...props} {...stylex.props(stylex.defaultMarker(), styles.root)} />;
}

export function Label(props: LabelProps) {
  return <BaseField.Label {...props} {...stylex.props(typography.label, styles.label)} />;
}

export function Control(props: ControlProps) {
  const grouped = useContext(ControlGroupContext);

  return (
    <BaseField.Control
      {...props}
      {...stylex.props(
        typography.body,
        styles.control,
        !grouped && styles.standaloneControl,
        grouped && styles.groupedControl,
      )}
    />
  );
}

export function ControlGroup({ children, ...props }: ControlGroupProps) {
  return (
    <ControlGroupContext.Provider value>
      <div {...props} {...stylex.props(styles.controlGroup)}>
        {children}
      </div>
    </ControlGroupContext.Provider>
  );
}

export function Suffix(props: SuffixProps) {
  return <div {...props} {...stylex.props(styles.suffix)} />;
}

export function Description(props: DescriptionProps) {
  return (
    <BaseField.Description {...props} {...stylex.props(typography.label, styles.description)} />
  );
}

export function Validity(props: BaseField.Validity.Props) {
  return <BaseField.Validity {...props} />;
}

export function Error({ visuallyHidden = false, ...props }: ErrorProps) {
  let visibility;
  if (visuallyHidden) visibility = styles.visuallyHidden;

  return (
    <BaseField.Error {...props} {...stylex.props(typography.label, styles.error, visibility)} />
  );
}

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: space[2],
    minWidth: 0,
  },
  label: { color: colors.text, fontWeight: fonts.medium },
  controlGroup: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
    minHeight: control.heightMd,
    overflow: "hidden",
    borderRadius: control.radius,
    backgroundColor: colors.surface,
    boxShadow: {
      default: `inset 0 0 0 1px ${colors.border}`,
      [stylex.when.ancestor("[data-focused]")]: `inset 0 0 0 1px ${colors.borderStrong}`,
      [stylex.when.ancestor("[data-invalid]")]: `inset 0 0 0 1px ${colors.statusNegativeBorder}`,
      [stylex.when.ancestor("[data-invalid][data-focused]")]:
        `inset 0 0 0 1px ${colors.statusNegative}`,
    },
    transitionProperty: "box-shadow",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-out",
  },
  control: {
    width: "100%",
    minWidth: 0,
    paddingBlock: space[2],
    paddingInline: space[3],
    appearance: "none",
    color: colors.text,
    outline: "none",
    "::placeholder": { color: colors.textPlaceholder, opacity: 1 },
  },
  standaloneControl: {
    minHeight: control.heightMd,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: {
      default: colors.border,
      ":focus-visible": colors.borderStrong,
      "[data-invalid]": colors.statusNegativeBorder,
      ":is([data-invalid]):focus-visible": colors.statusNegative,
    },
    borderRadius: control.radius,
    backgroundColor: colors.surface,
    boxShadow: "none",
    transitionProperty: "border-color",
    transitionDuration: "100ms",
    transitionTimingFunction: "ease-out",
  },
  groupedControl: {
    alignSelf: "stretch",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: "auto",
    minHeight: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
    boxShadow: "none",
  },
  suffix: {
    display: "flex",
    alignItems: "center",
    flex: "none",
    paddingInlineEnd: space[2],
  },
  description: { color: colors.textMuted, fontWeight: fonts.regular },
  error: { color: colors.statusNegative, fontWeight: fonts.regular },
  visuallyHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    borderWidth: 0,
  },
});
