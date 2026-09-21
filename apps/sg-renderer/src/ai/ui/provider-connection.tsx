import type { ConnectionState, ProviderConnection as Connection } from "@stargeist/domain/ai";
import { typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
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
    <section aria-labelledby={headingId} {...stylex.props(styles.provider)}>
      <header {...stylex.props(styles.summary)}>
        <h3 id={headingId} ref={heading} tabIndex={-1} {...stylex.props(typography.label)}>
          {connection.displayName}
        </h3>
        <ConnectionSummary state={connection.state} />
      </header>
      {editing && <APIKeyForm providerId={connection.providerId} onClose={closeEditor} />}
      {!editing && <ConnectionActions connection={connection} onEdit={() => setEditing(true)} />}
    </section>
  );
}

function ConnectionSummary({ state }: { state: ConnectionState }) {
  switch (state.status) {
    case "notConfigured":
      return <p {...stylex.props(styles.muted)}>No key added.</p>;
    case "unavailable":
      return (
        <p role="alert" {...stylex.props(styles.muted)}>
          {state.error.message}
        </p>
      );
    case "configured":
      return (
        <>
          <p {...stylex.props(styles.muted)}>Saved key {state.keyHint}</p>
          <p {...stylex.props(typography.label, styles.muted)}>
            Last checked {validatedAt.format(state.lastValidatedAt)}
          </p>
        </>
      );
  }
}

const styles = stylex.create({
  provider: { display: "flex", flexDirection: "column", gap: space[4] },
  summary: { display: "flex", flexDirection: "column", gap: space[1], minWidth: 0 },
  muted: { color: colors.textMuted, overflowWrap: "anywhere" },
});
