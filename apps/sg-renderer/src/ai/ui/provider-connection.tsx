import type { ConnectionState, ProviderConnection as Connection } from "@stargeist/domain/ai";
import { Item } from "@stargeist/ui";
import { useId, useRef, useState } from "react";
import { APIKeyForm } from "./api-key-form";
import { ConnectionActions } from "./connection-actions";

const validatedAt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function ProviderConnection({ connection }: { connection: Connection }) {
  const [editing, setEditing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();

  const closeEditor = () => {
    setEditing(false);
    heading.current?.focus();
  };

  return (
    <Item.Root aria-labelledby={headingId}>
      <Item.Content>
        <Item.Title id={headingId} ref={heading} tabIndex={-1}>
          {connection.displayName}
        </Item.Title>
        <ConnectionSummary state={connection.state} />
      </Item.Content>
      {editing && (
        <Item.Details>
          <APIKeyForm providerId={connection.providerId} onClose={closeEditor} />
        </Item.Details>
      )}
      {!editing && (
        <Item.Actions>
          <ConnectionActions connection={connection} onEdit={() => setEditing(true)} />
        </Item.Actions>
      )}
    </Item.Root>
  );
}

function ConnectionSummary({ state }: { state: ConnectionState }) {
  switch (state.status) {
    case "notConfigured":
      return <Item.Description>No key added.</Item.Description>;
    case "unavailable":
      return <Item.Description role="alert">{state.error.message}</Item.Description>;
    case "configured":
      return (
        <>
          <Item.Description>Saved key {state.keyHint}</Item.Description>
          <Item.Description>
            Last checked {validatedAt.format(state.lastValidatedAt)}
          </Item.Description>
        </>
      );
  }
}
