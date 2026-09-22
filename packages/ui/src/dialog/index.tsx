import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { Button } from "../button";
import { CloseIcon } from "../icons";
import { colors, fonts, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export function Root<Payload>(props: Omit<BaseDialog.Root.Props<Payload>, "modal">) {
  return <BaseDialog.Root {...props} modal />;
}

export function Trigger<Payload>(
  props: Omit<BaseDialog.Trigger.Props<Payload>, "className" | "style">,
) {
  return <BaseDialog.Trigger render={<Button />} {...props} />;
}

export type PopupProps = Omit<BaseDialog.Popup.Props, "className" | "style"> & {
  layout?: keyof typeof layouts;
};

export function Popup({ layout = "content", ...props }: PopupProps) {
  return (
    <BaseDialog.Portal {...stylex.props(styles.portal)}>
      <BaseDialog.Backdrop {...stylex.props(styles.transition, styles.backdrop)} />
      <BaseDialog.Viewport {...stylex.props(styles.viewport)}>
        <BaseDialog.Popup
          {...props}
          {...stylex.props(styles.transition, styles.popup, layouts[layout], typography.body)}
        />
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export function Title(props: Omit<BaseDialog.Title.Props, "className" | "style">) {
  return <BaseDialog.Title {...props} {...stylex.props(typography.body, styles.title)} />;
}

export function Header(props: Omit<ComponentProps<"div">, "className" | "style">) {
  return <div {...props} {...stylex.props(styles.header)} />;
}

export function Description(props: Omit<BaseDialog.Description.Props, "className" | "style">) {
  return <BaseDialog.Description {...props} {...stylex.props(styles.description)} />;
}

export function Actions(props: Omit<ComponentProps<"div">, "className" | "style">) {
  return <div {...props} {...stylex.props(styles.actions)} />;
}

export type CloseProps = Omit<BaseDialog.Close.Props, "className" | "style">;

export function Close({ children, render, "aria-label": ariaLabel, ...props }: CloseProps) {
  let content = children;
  let closeRender = render;
  let label = ariaLabel;

  if (closeRender === undefined)
    closeRender = <Button appearance="ghost" shape="square" size="xs" />;
  if (content === undefined) {
    content = <CloseIcon aria-hidden="true" />;
    if (label === undefined) label = "Close dialog";
  }

  return (
    <BaseDialog.Close {...props} aria-label={label} render={closeRender}>
      {content}
    </BaseDialog.Close>
  );
}

const styles = stylex.create({
  portal: { position: "relative", zIndex: 1 },
  transition: {
    opacity: { default: 1, ":is([data-starting-style], [data-ending-style])": 0 },
    transitionProperty: "opacity",
    transitionDuration: {
      default: "140ms",
      "@media (prefers-reduced-motion: reduce)": "0ms",
    },
    transitionTimingFunction: "ease-out",
  },
  backdrop: { position: "fixed", inset: 0, backgroundColor: colors.backdrop },
  viewport: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: space[4],
    paddingBlockStart: `clamp(${space[4]}, 15dvh, 8rem)`,
  },
  popup: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxHeight: "100%",
    minWidth: 0,
    overscrollBehavior: "contain",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    boxShadow: shadows.raised,
    outline: "none",
    overflowWrap: "anywhere",
    transitionProperty: "opacity, transform",
    transform: {
      default: "translateY(0)",
      ":is([data-starting-style], [data-ending-style])": "translateY(-4px)",
    },
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space[4],
  },
  title: { fontWeight: fonts.semibold },
  description: { color: colors.textMuted },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: space[2] },
});

const layouts = stylex.create({
  content: {
    gap: space[4],
    maxWidth: "32rem",
    overflowY: "auto",
    padding: space[5],
  },
  command: {
    maxWidth: "40rem",
    overflow: "hidden",
  },
});
