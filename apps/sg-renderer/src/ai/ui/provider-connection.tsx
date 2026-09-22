import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ConnectionState, ProviderConnection as Connection } from "@stargeist/ai";
import { Dialog, Item, Ping } from "@stargeist/ui";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Atom, type AsyncResult } from "effect/unstable/reactivity";
import { useId, useRef, useState } from "react";
import { failureMessage } from "#src/client/index.ts";
import { ProviderBadge, providerEditor } from "../providers";
import { ConnectionActions } from "./connection-actions";
import { useProviderConnections } from "./use-ai";
import { useProviderConnectionHealth } from "./use-provider-connection-health";

export function ProviderConnection({ connection }: { connection: Connection }) {
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const providerConnections = useProviderConnections();
  const Editor = providerEditor(connection.providerId);
  const operation = providerConnections.operation(connection.providerId);
  const refreshProviders = useAtomRefresh(providerConnections.list);
  const operationResult = useAtomValue(operation);
  const resetOperation = useAtomSet(operation);
  let lastValidatedAt = 0;
  let summary: string | null = null;
  let editorTitle = `Connect ${connection.displayName}`;

  if (connection.state.status === "configured") {
    lastValidatedAt = connection.state.lastValidatedAt;
    summary = connection.state.summary;
    editorTitle = `Edit ${connection.displayName} connection`;
  }

  const health = useProviderConnectionHealth({
    check: providerConnections.healthCheck(connection.providerId),
    enabled: connection.state.status === "configured",
    lastValidatedAt,
    paused: editing || operationResult.waiting,
  });

  const dismissEditor = () => {
    resetOperation(Atom.Reset);
    setEditing(false);
  };

  const presentation = connectionPresentation(connection.state, health);

  return (
    <>
      <Item.Root aria-labelledby={headingId}>
        <Item.Main>
          <Item.Media>
            <ProviderBadge providerId={connection.providerId} />
          </Item.Media>
          <Item.Content>
            <div {...stylex.props(styles.title)}>
              <Ping tone={presentation.tone} label={presentation.label} />
              <Item.Title id={headingId}>{connection.displayName}</Item.Title>
            </div>
            {presentation.error !== undefined && (
              <Item.Description role="alert">{presentation.error}</Item.Description>
            )}
          </Item.Content>
        </Item.Main>
        {Editor && (
          <Item.Aside>
            <ConnectionActions
              connection={connection}
              editButton={editButton}
              operation={operation}
              onRetryProviders={refreshProviders}
              onEdit={() => setEditing(true)}
            />
          </Item.Aside>
        )}
      </Item.Root>
      <Dialog.Root
        open={editing}
        onOpenChange={(open) => {
          if (!open) dismissEditor();
        }}
      >
        <Dialog.Popup finalFocus={editButton}>
          <Dialog.Header>
            <Dialog.Title>{editorTitle}</Dialog.Title>
            <Dialog.Close />
          </Dialog.Header>
          {Editor && (
            <Editor operation={operation} summary={summary} onClose={() => setEditing(false)} />
          )}
        </Dialog.Popup>
      </Dialog.Root>
    </>
  );
}

type HealthResult = AsyncResult.AsyncResult<Connection, unknown>;

type ConnectionPresentation = {
  error?: string;
  label: string;
  tone: "neutral" | "positive" | "negative";
};

function connectionPresentation(
  state: ConnectionState,
  health: HealthResult,
): ConnectionPresentation {
  switch (state.status) {
    case "notConfigured":
      return { label: "Not connected", tone: "neutral" };
    case "unavailable":
      return { error: state.error.message, label: "Unavailable", tone: "negative" };
    case "configured":
      if (health._tag === "Failure")
        return {
          error: failureMessage(health.cause),
          label: "Disconnected",
          tone: "negative",
        };
      return { label: "Connected", tone: "positive" };
  }
}

const styles = stylex.create({
  title: { display: "flex", alignItems: "center", gap: space[2] },
});
