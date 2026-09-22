import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ProviderConnection } from "@stargeist/domain/ai";
import { Button, ConfirmDialog } from "@stargeist/ui";
import { Atom } from "effect/unstable/reactivity";
import { useState, type RefObject } from "react";
import { OperationFeedback, operationDisabled } from "./operation";
import { useAIProviderConnectionsState } from "./use-state";

export function RemoveProviderKey({
  connection,
  fallbackFocus,
}: {
  connection: ProviderConnection;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const operation = useAIProviderConnectionsState().operation(connection.providerId);
  const result = useAtomValue(operation);
  const remove = useAtomSet(operation, { mode: "promiseExit" });
  const reset = useAtomSet(operation);

  const confirm = async () => {
    if (operationDisabled(result)) return;
    const exit = await remove({ type: "remove" });
    if (exit._tag === "Success") setOpen(false);
  };

  const finalFocus = () => {
    if (result._tag === "Success" && result.value === "remove") return fallbackFocus.current;
    return true;
  };

  return (
    <ConfirmDialog.Root
      open={open}
      pending={result.waiting}
      onOpenChange={(nextOpen) => {
        reset(Atom.Reset);
        setOpen(nextOpen);
      }}
    >
      {connection.state.status !== "notConfigured" && (
        <ConfirmDialog.Trigger
          disabled={operationDisabled(result)}
          render={<Button appearance="ghost" size="sm" />}
        >
          Remove key
        </ConfirmDialog.Trigger>
      )}
      <ConfirmDialog.Popup finalFocus={finalFocus}>
        <ConfirmDialog.Title>Remove {connection.displayName} key?</ConfirmDialog.Title>
        <ConfirmDialog.Description>
          This removes the saved key from this device. You’ll need to enter it again to reconnect.
        </ConfirmDialog.Description>
        <OperationFeedback result={result} pending="Removing key…" />
        <ConfirmDialog.Actions>
          <ConfirmDialog.Cancel>Cancel</ConfirmDialog.Cancel>
          <ConfirmDialog.Confirm
            disabled={operationDisabled(result)}
            onClick={() => void confirm()}
          >
            Remove key
          </ConfirmDialog.Confirm>
        </ConfirmDialog.Actions>
      </ConfirmDialog.Popup>
    </ConfirmDialog.Root>
  );
}
