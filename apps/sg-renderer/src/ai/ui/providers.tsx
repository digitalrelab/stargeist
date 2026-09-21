import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { ProviderConnection } from "./provider-connection";
import { useAIProviderConnectionsState } from "./use-state";

export function Providers() {
  const { connections } = useAIProviderConnectionsState();
  const result = useAtomValue(connections);
  const refresh = useAtomRefresh(connections);
  const providers = AsyncResult.value(result);

  return (
    <section aria-labelledby="ai-providers" {...stylex.props(styles.section)}>
      <header {...stylex.props(styles.header)}>
        <h2 id="ai-providers" {...stylex.props(typography.label)}>
          Providers
        </h2>
        <p {...stylex.props(styles.muted)}>API keys are shared across workspaces on this device.</p>
      </header>
      {result._tag === "Initial" && <p role="status">Loading providers…</p>}
      {result._tag === "Failure" && (
        <div {...stylex.props(styles.header)}>
          <p role="alert">{failureMessage(result.cause)}</p>
          {canRetryFailure(result.cause) && (
            <Button appearance="soft" onClick={refresh} disabled={result.waiting}>
              Retry
            </Button>
          )}
        </div>
      )}
      {Option.isSome(providers) && providers.value.length === 0 && (
        <p {...stylex.props(styles.muted)}>No providers available.</p>
      )}
      {Option.isSome(providers) &&
        providers.value.map((provider) => (
          <ProviderConnection key={provider.providerId} connection={provider} />
        ))}
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space[6],
    maxWidth: "640px",
    width: "100%",
  },
  header: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[2] },
  muted: { color: colors.textMuted },
});
