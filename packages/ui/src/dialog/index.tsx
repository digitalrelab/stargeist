import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps } from "react";
import { Button } from "../button";
import { colors, radii, shadows, space } from "../tokens.stylex";
import { typography } from "../typography";

export function Root<Payload>(props: Omit<BaseDialog.Root.Props<Payload>, "modal">) {
  return <BaseDialog.Root {...props} modal />;
}

export function Trigger<Payload>(
  props: Omit<BaseDialog.Trigger.Props<Payload>, "className" | "style">,
) {
  return <BaseDialog.Trigger render={<Button />} {...props} />;
}

export type PopupProps = Omit<BaseDialog.Popup.Props, "className" | "style">;

export function Popup(props: PopupProps) {
  return (
    <BaseDialog.Portal {...stylex.props(styles.portal)}>
      <BaseDialog.Backdrop {...stylex.props(styles.backdrop)} />
      <BaseDialog.Viewport {...stylex.props(styles.viewport)}>
        <BaseDialog.Popup {...props} {...stylex.props(styles.popup, typography.body)} />
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

export function Title(props: Omit<BaseDialog.Title.Props, "className" | "style">) {
  return <BaseDialog.Title {...props} {...stylex.props(typography.heading)} />;
}

export function Description(props: Omit<BaseDialog.Description.Props, "className" | "style">) {
  return <BaseDialog.Description {...props} {...stylex.props(styles.description)} />;
}

export function Actions(props: Omit<ComponentProps<"div">, "className" | "style">) {
  return <div {...props} {...stylex.props(styles.actions)} />;
}

export type CloseProps = Omit<BaseDialog.Close.Props, "className" | "style">;

export function Close(props: CloseProps) {
  return <BaseDialog.Close render={<Button appearance="ghost" />} {...props} />;
}

const styles = stylex.create({
  portal: { position: "relative", zIndex: 1 },
  backdrop: { position: "fixed", inset: 0, backgroundColor: colors.backdrop },
  viewport: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: space[4],
  },
  popup: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
    width: "100%",
    maxWidth: "32rem",
    maxHeight: "100%",
    minWidth: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: space[6],
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceRaised,
    color: colors.text,
    boxShadow: shadows.raised,
    outline: "none",
    overflowWrap: "anywhere",
  },
  description: { color: colors.textMuted },
  actions: { display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: space[2] },
});
