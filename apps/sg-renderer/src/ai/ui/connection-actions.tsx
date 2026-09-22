import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ProviderConnection } from "@stargeist/ai";
import { Button, ConfirmDialog, DeleteIcon, EditIcon, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Atom, type AsyncResult } from "effect/unstable/reactivity";
import { useState, type RefObject } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import type { ConnectionAction, ProviderConnectionOperation } from "../state";

type OperationResult = AsyncResult.AsyncResult<ConnectionAction["type"], unknown>;

export function ConnectionActions({
  connection,
  editButton,
  operation,
  onRetryProviders,
  onEdit,
}: {
  connection: ProviderConnection;
  editButton: RefObject<HTMLButtonElement | null>;
  operation: ProviderConnectionOperation;
  onRetryProviders: () => void;
  onEdit: () => void;
}) {
  const result = useAtomValue(operation);
  const run = useAtomSet(operation);
  const disabled = operationDisabled(result);

  const edit = () => {
    run(Atom.Reset);
    onEdit();
  };

  return (
    <div {...stylex.props(styles.actions)}>
      <EditConnectionButton
        connection={connection}
        disabled={disabled}
        ref={editButton}
        onClick={edit}
      />
      {connection.state.status === "unavailable" && (
        <Button appearance="ghost" disabled={disabled} onClick={onRetryProviders}>
          Retry
        </Button>
      )}
      <DisconnectConfirmation
        connection={connection}
        fallbackFocus={editButton}
        operation={operation}
      />
    </div>
  );
}

function EditConnectionButton({
  connection,
  disabled,
  ref,
  onClick,
}: {
  connection: ProviderConnection;
  disabled: boolean;
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
}) {
  if (connection.state.status === "configured") {
    return (
      <Button
        ref={ref}
        appearance="ghost"
        shape="square"
        disabled={disabled}
        aria-label={`Edit ${connection.displayName} connection`}
        onClick={onClick}
      >
        <EditIcon aria-hidden="true" />
      </Button>
    );
  }

  let label = "Connect";
  if (connection.state.status === "unavailable") label = "Configure";

  return (
    <Button ref={ref} appearance="soft" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  );
}

function DisconnectConfirmation({
  connection,
  fallbackFocus,
  operation,
}: {
  connection: ProviderConnection;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  operation: ProviderConnectionOperation;
}) {
  const [open, setOpen] = useState(false);
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
        <ConfirmDialog.Trigger
          disabled={disabled}
          aria-label={`Disconnect ${connection.displayName}`}
          render={<Button appearance="ghost" shape="square" />}
        >
          <DeleteIcon aria-hidden="true" />
        </ConfirmDialog.Trigger>
      )}
      <ConfirmDialog.Popup finalFocus={finalFocus}>
        <ConfirmDialog.Title>Disconnect {connection.displayName}?</ConfirmDialog.Title>
        <ConfirmDialog.Description>
          This removes the saved connection settings from this device.
        </ConfirmDialog.Description>
        <div {...stylex.props(styles.dialogFooter)}>
          <ConfirmDialog.Actions>
            <ConfirmDialog.Cancel>Cancel</ConfirmDialog.Cancel>
            <ConfirmDialog.Confirm
              appearance="danger"
              disabled={disabled}
              onClick={() => void confirm()}
            >
              Disconnect
            </ConfirmDialog.Confirm>
          </ConfirmDialog.Actions>
          <RemovalFeedback result={result} />
        </div>
      </ConfirmDialog.Popup>
    </ConfirmDialog.Root>
  );
}

function operationDisabled(result: OperationResult) {
  if (result.waiting) return true;
  if (result._tag === "Failure") return !canRetryFailure(result.cause);
  return false;
}

function RemovalFeedback({ result }: { result: OperationResult }) {
  if (result.waiting)
    return (
      <p role="status" {...stylex.props(styles.feedback, typography.label)}>
        Disconnecting…
      </p>
    );
  if (result._tag === "Failure")
    return (
      <p role="alert" {...stylex.props(styles.feedback, typography.label)}>
        {failureMessage(result.cause)}
      </p>
    );
  return null;
}

const styles = stylex.create({
  actions: { display: "flex", flexWrap: "wrap", gap: space[1] },
  dialogFooter: { display: "flex", flexDirection: "column", gap: space[2] },
  feedback: { color: colors.textMuted, overflowWrap: "anywhere" },
});
