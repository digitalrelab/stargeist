import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ConnectionState, ProviderConnection } from "@stargeist/domain/ai";
import { Button, ConfirmDialog } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Atom } from "effect/unstable/reactivity";
import { useRef, useState, type RefObject } from "react";
import { OperationFeedback, operationDisabled } from "./operation";
import { useAIProviderConnectionsState } from "./use-state";

export function ConnectionActions({
  connection,
  onEdit,
}: {
  connection: ProviderConnection;
  onEdit: () => void;
}) {
  const state = useAIProviderConnectionsState();
  const operation = state.operation(connection.providerId);
  const result = useAtomValue(operation);
  const run = useAtomSet(operation);
  const refresh = useAtomRefresh(state.connections);
  const disabled = operationDisabled(result);
  const editButton = useRef<HTMLButtonElement>(null);

  const edit = () => {
    run(Atom.Reset);
    onEdit();
  };

  return (
    <div {...stylex.props(styles.controls)}>
      <div {...stylex.props(styles.actions)}>
        <Button ref={editButton} appearance="soft" disabled={disabled} onClick={edit}>
          {editLabel(connection.state)}
        </Button>
        {connection.state.status === "configured" && (
          <Button appearance="ghost" disabled={disabled} onClick={() => run({ type: "check" })}>
            Check key
          </Button>
        )}
        {connection.state.status === "unavailable" && (
          <Button appearance="ghost" disabled={disabled} onClick={refresh}>
            Retry
          </Button>
        )}
        <RemoveKeyConfirmation connection={connection} fallbackFocus={editButton} />
      </div>
      <OperationFeedback result={result} pending="Updating connection…" />
    </div>
  );
}

function RemoveKeyConfirmation({
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
  const disabled = operationDisabled(result);

  const confirm = async () => {
    if (disabled) return;
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
        <ConfirmDialog.Trigger disabled={disabled} render={<Button appearance="ghost" />}>
          Remove key
        </ConfirmDialog.Trigger>
      )}
      <ConfirmDialog.Popup finalFocus={finalFocus}>
        <ConfirmDialog.Title>Remove {connection.displayName} key?</ConfirmDialog.Title>
        <ConfirmDialog.Description>
          This removes the saved key from this device. You’ll need to enter it again to reconnect.
        </ConfirmDialog.Description>
        <div {...stylex.props(styles.dialogFooter)}>
          <ConfirmDialog.Actions>
            <ConfirmDialog.Cancel>Cancel</ConfirmDialog.Cancel>
            <ConfirmDialog.Confirm
              appearance="danger"
              disabled={disabled}
              onClick={() => void confirm()}
            >
              Remove key
            </ConfirmDialog.Confirm>
          </ConfirmDialog.Actions>
          {(result.waiting || result._tag === "Failure") && (
            <OperationFeedback result={result} pending="Removing key…" />
          )}
        </div>
      </ConfirmDialog.Popup>
    </ConfirmDialog.Root>
  );
}

function editLabel(state: ConnectionState) {
  switch (state.status) {
    case "notConfigured":
      return "Add key";
    case "configured":
      return "Replace key";
    case "unavailable":
      return "Set key";
  }
}

const styles = stylex.create({
  controls: { display: "flex", flexDirection: "column", gap: space[4] },
  actions: { display: "flex", flexWrap: "wrap", gap: space[1] },
  dialogFooter: { display: "flex", flexDirection: "column", gap: space[2] },
});
