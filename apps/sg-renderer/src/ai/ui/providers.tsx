import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Button, Item, typography } from "@stargeist/ui";
import { colors, fonts, space } from "@stargeist/ui/tokens.stylex";
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
        <h2 id="ai-providers" {...stylex.props(typography.body, styles.title)}>
          Providers
        </h2>
        <p {...stylex.props(typography.label, styles.muted)}>
          API keys are shared across workspaces on this device.
        </p>
      </header>
      <Item.Group>
        {result._tag === "Initial" && (
          <Item.Root>
            <Item.Content>
              <Item.Description role="status">Loading providers…</Item.Description>
            </Item.Content>
          </Item.Root>
        )}
        {result._tag === "Failure" && (
          <Item.Root>
            <Item.Content>
              <Item.Description role="alert">{failureMessage(result.cause)}</Item.Description>
            </Item.Content>
            {canRetryFailure(result.cause) && (
              <Item.Actions>
                <Button appearance="soft" onClick={refresh} disabled={result.waiting}>
                  Retry
                </Button>
              </Item.Actions>
            )}
          </Item.Root>
        )}
        {Option.isSome(providers) && providers.value.length === 0 && (
          <Item.Root>
            <Item.Content>
              <Item.Description>No providers available.</Item.Description>
            </Item.Content>
          </Item.Root>
        )}
        {Option.isSome(providers) &&
          providers.value.map((provider) => (
            <ProviderConnection key={provider.providerId} connection={provider} />
          ))}
      </Item.Group>
    </section>
  );
}

const styles = stylex.create({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: space[4],
    width: "100%",
  },
  header: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[1] },
  title: { fontWeight: fonts.semibold },
  muted: { color: colors.textMuted, fontWeight: fonts.regular },
});
