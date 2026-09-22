import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ConnectionState, ProviderConnection } from "@stargeist/domain/ai";
import { Button } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Atom } from "effect/unstable/reactivity";
import { useRef } from "react";
import { OperationFeedback, operationDisabled } from "./operation";
import { RemoveProviderKey } from "./remove-provider-key";
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
        <Button ref={editButton} appearance="soft" size="sm" disabled={disabled} onClick={edit}>
          {editLabel(connection.state)}
        </Button>
        {connection.state.status === "configured" && (
          <Button
            appearance="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "check" })}
          >
            Check key
          </Button>
        )}
        {connection.state.status === "unavailable" && (
          <Button appearance="ghost" size="sm" disabled={disabled} onClick={refresh}>
            Retry
          </Button>
        )}
        <RemoveProviderKey connection={connection} fallbackFocus={editButton} />
      </div>
      <OperationFeedback result={result} pending="Updating connection…" />
    </div>
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
});
