import { AlertDialog } from "@base-ui/react/alert-dialog";
import { createContext, useContext, useRef, type RefObject } from "react";
import { Button, type ButtonProps } from "../button";
import * as Dialog from "../dialog";

const ConfirmationContext = createContext<{
  pending: boolean;
  cancel: RefObject<HTMLButtonElement | null>;
} | null>(null);

function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) throw new Error("ConfirmDialog parts must be inside ConfirmDialog.Root.");
  return context;
}

export function Root<Payload>({
  pending = false,
  onOpenChange,
  ...props
}: AlertDialog.Root.Props<Payload> & { pending?: boolean }) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <ConfirmationContext.Provider value={{ pending, cancel }}>
      <AlertDialog.Root
        {...props}
        onOpenChange={(open, details) => {
          if (!open && pending) {
            details.cancel();
            return;
          }
          onOpenChange?.(open, details);
        }}
      />
    </ConfirmationContext.Provider>
  );
}

export function Trigger<Payload>(
  props: Omit<AlertDialog.Trigger.Props<Payload>, "className" | "style">,
) {
  return <AlertDialog.Trigger render={<Button />} {...props} />;
}

export function Popup(props: Omit<Dialog.PopupProps, "initialFocus">) {
  const { cancel } = useConfirmation();
  return <Dialog.Popup {...props} initialFocus={cancel} />;
}

export { Title, Description, Actions } from "../dialog";

export function Cancel({
  ref,
  disabled,
  ...props
}: Omit<Dialog.CloseProps, "render" | "nativeButton">) {
  const { pending, cancel } = useConfirmation();
  return (
    <Dialog.Close
      {...props}
      ref={cancel}
      render={<Button ref={ref} appearance="soft" />}
      disabled={pending || disabled}
    />
  );
}

export function Confirm({ disabled, ...props }: ButtonProps) {
  const { pending } = useConfirmation();
  return <Button type="button" {...props} disabled={pending || disabled} aria-busy={pending} />;
}
