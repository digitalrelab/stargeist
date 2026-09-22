import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ModelReference, ProviderModelCatalog } from "@stargeist/ai";
import type { AgentModelPreferenceError } from "@stargeist/domain";
import { Button, Item, Skeleton, typography } from "@stargeist/ui";
import { colors, control, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Option } from "effect";
import { AsyncResult } from "effect/unstable/reactivity";
import { canRetryFailure, failureMessage, type ClientUnavailableError } from "#src/client/index.ts";
import { ModelSelect } from "./model-select";
import { ProviderConnection } from "./provider-connection";
import { useAgentModels, useProviderConnections } from "./use-ai";

const emptyCatalogs: ReadonlyArray<ProviderModelCatalog> = [];

type CatalogResult = AsyncResult.AsyncResult<
  ReadonlyArray<ProviderModelCatalog>,
  ClientUnavailableError
>;
type DefaultModelResult = AsyncResult.AsyncResult<
  ModelReference | null,
  AgentModelPreferenceError | ClientUnavailableError
>;
type Feedback = { readonly message: string; readonly canRetry: boolean } | null;

export function AISettingsPage() {
  const settings = useDefaultAgentModelSettings();
  const providerConnections = useProviderConnections();
  const providerListResult = useAtomValue(providerConnections.list);
  const refreshProviderList = useAtomRefresh(providerConnections.list);
  const providers = AsyncResult.value(providerListResult);

  return (
    <div {...stylex.props(styles.page)}>
      <section aria-labelledby="ai-models" {...stylex.props(styles.section)}>
        <header {...stylex.props(styles.header)}>
          <h2 id="ai-models" {...stylex.props(typography.body, styles.title)}>
            Models
          </h2>
          <p {...stylex.props(typography.label, styles.muted)}>Choose models for AI tasks.</p>
        </header>
        <Item.Group>
          <Item.Root>
            <Item.Content>
              <Item.Title>Default model</Item.Title>
              <Item.Description>Used when no more specific model is selected.</Item.Description>
            </Item.Content>
            <Item.Aside>
              <div {...stylex.props(styles.control)}>
                {settings.loading && <Skeleton styles={styles.modelSkeleton} />}
                {!settings.loading && (
                  <ModelSelect
                    ariaLabel="Default model"
                    catalogs={settings.catalogs}
                    disabled={settings.selectionDisabled}
                    value={settings.saved}
                    onValueChange={settings.update}
                  />
                )}
              </div>
              <ModelSettingsFeedback feedback={settings.feedback} onRetry={settings.retry} />
            </Item.Aside>
          </Item.Root>
        </Item.Group>
      </section>
      <section aria-labelledby="ai-providers" {...stylex.props(styles.section)}>
        <header {...stylex.props(styles.header)}>
          <h2 id="ai-providers" {...stylex.props(typography.body, styles.title)}>
            Providers
          </h2>
          <p {...stylex.props(typography.label, styles.muted)}>
            Connect to the AI providers of your choice.
          </p>
        </header>
        <Item.Group>
          {providerListResult._tag === "Initial" && (
            <Item.Root aria-label="Loading providers" aria-busy="true">
              <Item.Main>
                <Item.Media>
                  <Skeleton styles={styles.providerIconSkeleton} />
                </Item.Media>
                <Item.Content>
                  <Skeleton styles={styles.providerNameSkeleton} />
                </Item.Content>
              </Item.Main>
            </Item.Root>
          )}
          {providerListResult._tag === "Failure" && (
            <Item.Root>
              <Item.Content>
                <Item.Description role="alert">
                  {failureMessage(providerListResult.cause)}
                </Item.Description>
              </Item.Content>
              {canRetryFailure(providerListResult.cause) && (
                <Item.Actions>
                  <Button
                    appearance="soft"
                    onClick={refreshProviderList}
                    disabled={providerListResult.waiting}
                  >
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
    </div>
  );
}

function useDefaultAgentModelSettings() {
  const agentModels = useAgentModels();
  const catalogsResult = useAtomValue(agentModels.catalogs);
  const defaultModelResult = useAtomValue(agentModels.defaultModel);
  const updateResult = useAtomValue(agentModels.updateDefaultModel);
  const refreshDefaultModel = useAtomRefresh(agentModels.defaultModel);
  const update = useAtomSet(agentModels.updateDefaultModel);
  const view = presentModelSettings(catalogsResult, defaultModelResult, updateResult);

  let retry: (() => void) | undefined;
  if (view.feedback?.canRetry) retry = refreshDefaultModel;

  return {
    ...view,
    retry,
    update,
  };
}

function presentModelSettings(
  catalogsResult: CatalogResult,
  defaultModelResult: DefaultModelResult,
  updateResult: DefaultModelResult,
) {
  const catalogsValue = AsyncResult.value(catalogsResult);
  const defaultModelValue = AsyncResult.value(defaultModelResult);
  const catalogs = Option.getOrElse(catalogsValue, () => emptyCatalogs);
  let saved: ModelReference | null = null;
  if (Option.isSome(defaultModelValue)) saved = defaultModelValue.value;
  const hasModels = catalogs.some(
    (catalog) => catalog.state.status === "available" && catalog.state.models.length > 0,
  );
  const ready = Option.isSome(catalogsValue) && Option.isSome(defaultModelValue);

  return {
    catalogs,
    saved,
    loading: catalogsResult._tag === "Initial" || defaultModelResult._tag === "Initial",
    selectionDisabled: !ready || !hasModels || updateResult.waiting,
    feedback: modelSettingsFeedback(catalogsResult, defaultModelResult, updateResult),
  };
}

function modelSettingsFeedback(
  catalogsResult: CatalogResult,
  defaultModelResult: DefaultModelResult,
  updateResult: DefaultModelResult,
): Feedback {
  if (updateResult.waiting) return null;
  if (updateResult._tag === "Failure") {
    if (!canRetryFailure(updateResult.cause))
      return { message: "Could not save the model.", canRetry: false };
    return { message: failureMessage(updateResult.cause), canRetry: false };
  }
  if (catalogsResult._tag === "Failure") {
    return { message: "Models could not be loaded.", canRetry: false };
  }
  if (defaultModelResult._tag === "Failure") {
    if (!canRetryFailure(defaultModelResult.cause))
      return {
        message: "Could not load the default model.",
        canRetry: false,
      };
    return {
      message: failureMessage(defaultModelResult.cause),
      canRetry: true,
    };
  }
  return null;
}

function ModelSettingsFeedback({
  feedback,
  onRetry,
}: {
  feedback: Feedback;
  onRetry: (() => void) | undefined;
}) {
  if (!feedback) return null;
  return (
    <div {...stylex.props(styles.failure)}>
      <p role="alert" {...stylex.props(typography.label, styles.feedback)}>
        {feedback.message}
      </p>
      {onRetry && (
        <Button appearance="ghost" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

const styles = stylex.create({
  page: { display: "flex", flexDirection: "column", gap: space[8] },
  section: { display: "flex", flexDirection: "column", gap: space[4], width: "100%" },
  header: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: space[1] },
  title: { fontWeight: fonts.semibold },
  muted: { color: colors.textMuted, fontWeight: fonts.regular },
  control: {
    inlineSize: "min(100%, 26rem)",
  },
  modelSkeleton: { blockSize: control.heightMd },
  providerIconSkeleton: { inlineSize: "2rem", blockSize: "2rem" },
  providerNameSkeleton: { inlineSize: "8rem", blockSize: space[3] },
  failure: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: space[2] },
  feedback: { color: colors.textMuted, fontWeight: fonts.regular, overflowWrap: "anywhere" },
});
