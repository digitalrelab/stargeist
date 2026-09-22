import type { Model, ModelReference, ProviderModelCatalog } from "@stargeist/ai";
import {
  AudioIcon,
  Button,
  ChevronsUpDownIcon,
  Combobox,
  ImageIcon,
  ReasoningIcon,
  ScrollArea,
  Tabs,
  Tooltip,
  VideoIcon,
} from "@stargeist/ui";
import { colors, control, fonts, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { defaultRangeExtractor, useVirtualizer, type Range } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ProviderIcon } from "../providers";

type ModelOption = Pick<Model, "reference" | "name" | "publisher" | "pricing"> & {
  readonly capabilities: Model["capabilities"] | null;
  readonly providerDisplayName: string;
};

type Capability = "image" | "video" | "audio" | "reasoning";

const capabilityIcons = {
  image: { label: "Analyzes images", Icon: ImageIcon },
  video: { label: "Analyzes video", Icon: VideoIcon },
  audio: { label: "Analyzes audio", Icon: AudioIcon },
  reasoning: { label: "Reasoning", Icon: ReasoningIcon },
} satisfies Record<Capability, { readonly label: string; readonly Icon: typeof ImageIcon }>;

type ModelGroup = {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<ModelOption>;
};

type Highlight = {
  readonly model: ModelOption | undefined;
  readonly reason: "keyboard" | "pointer" | "none";
};
const emptyModels: ReadonlyArray<ModelOption> = [];
const estimatedModelRowHeight = 58;

export function ModelSelect({
  ariaLabel,
  catalogs,
  disabled,
  value,
  onValueChange,
}: {
  ariaLabel: string;
  catalogs: ReadonlyArray<ProviderModelCatalog>;
  disabled: boolean;
  value: ModelReference | null;
  onValueChange: (model: ModelReference) => void;
}) {
  const options = useMemo(() => modelOptions(catalogs, value), [catalogs, value]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Highlight>({ model: undefined, reason: "none" });
  const activeProvider =
    options.groups.find((group) => group.id === activeProviderId) ??
    options.groups.find((group) => group.id === value?.providerId) ??
    options.groups[0];

  return (
    <Combobox.Root<ModelOption>
      disabled={disabled}
      items={activeProvider?.items ?? emptyModels}
      value={options.selected}
      autoHighlight
      virtualized
      itemToStringLabel={modelLabel}
      itemToStringValue={modelKey}
      isItemEqualToValue={equalModels}
      filter={filterModel}
      onItemHighlighted={(model, details) => setHighlight({ model, reason: details.reason })}
      onOpenChange={(open) => {
        if (open) setActiveProviderId(value?.providerId ?? null);
      }}
      onValueChange={(model) => {
        if (model) onValueChange(model.reference);
      }}
    >
      <Combobox.Trigger
        aria-label={ariaLabel}
        render={<Button appearance="soft" size="md" styles={styles.trigger} />}
      >
        <span {...stylex.props(styles.triggerContent)}>
          <Combobox.Value>
            {(model: ModelOption | null) => {
              if (!model) return <span {...stylex.props(styles.placeholder)}>Choose a model</span>;
              return <ModelValue model={model} />;
            }}
          </Combobox.Value>
        </span>
        <span aria-hidden="true" {...stylex.props(styles.triggerIndicator)}>
          <ChevronsUpDownIcon />
        </span>
      </Combobox.Trigger>
      <Combobox.Popup aria-label={ariaLabel} styles={styles.popup}>
        <Tabs.Root
          value={activeProvider?.id ?? null}
          orientation="vertical"
          onValueChange={(id) => {
            if (typeof id === "string") setActiveProviderId(id);
          }}
          {...stylex.props(styles.tabLayout)}
        >
          <Tabs.List aria-label="Model providers" activateOnFocus {...stylex.props(styles.rail)}>
            {options.groups.map((group) => (
              <Tooltip.Root key={group.id}>
                <Tooltip.Trigger
                  render={
                    <Tabs.Tab
                      value={group.id}
                      aria-label={group.label}
                      render={<Button appearance="ghost" shape="square" size="sm" />}
                    />
                  }
                >
                  <ProviderIcon providerId={group.id} />
                </Tooltip.Trigger>
                <Tooltip.Popup>{group.label}</Tooltip.Popup>
              </Tooltip.Root>
            ))}
          </Tabs.List>
          {activeProvider && (
            <Tabs.Panel value={activeProvider.id} {...stylex.props(styles.modelPane)}>
              <Combobox.Input aria-label="Search models" placeholder="Search models…" />
              <ModelList highlight={highlight} />
            </Tabs.Panel>
          )}
        </Tabs.Root>
      </Combobox.Popup>
    </Combobox.Root>
  );
}

function ModelList({ highlight }: { highlight: Highlight }) {
  const viewport = useRef<HTMLDivElement>(null);
  const models = Combobox.useFilteredItems<ModelOption>();
  const highlightedIndex = models.findIndex((model) => model === highlight.model);
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      if (highlightedIndex >= 0 && !indexes.includes(highlightedIndex)) {
        indexes.push(highlightedIndex);
        indexes.sort((left, right) => left - right);
      }
      return indexes;
    },
    [highlightedIndex],
  );
  const getItemKey = useCallback((index: number) => modelKey(models[index]!), [models]);
  const virtualizer = useVirtualizer({
    count: models.length,
    getScrollElement: () => viewport.current,
    getItemKey,
    estimateSize: () => estimatedModelRowHeight,
    rangeExtractor,
    overscan: 8,
    paddingStart: 4,
    paddingEnd: 4,
  });

  useLayoutEffect(() => {
    virtualizer.scrollToOffset(0);
  }, [models, virtualizer]);

  useLayoutEffect(() => {
    if (highlightedIndex < 0 || highlight.reason === "pointer") return;
    let align: "auto" | "center" = "auto";
    if (highlight.reason === "none") align = "center";
    virtualizer.scrollToIndex(highlightedIndex, { align });
  }, [highlightedIndex, highlight.reason, models, virtualizer]);

  return (
    <ScrollArea.Root>
      <ScrollArea.Viewport ref={viewport} tabIndex={-1}>
        <ScrollArea.Content>
          <Combobox.Empty>No matching models.</Combobox.Empty>
          <Combobox.List styles={styles.list(virtualizer.getTotalSize())}>
            {virtualizer.getVirtualItems().map((row) => {
              const model = models[row.index]!;
              const capabilities = visibleCapabilities(model.capabilities);
              return (
                <Combobox.Item
                  key={row.key}
                  index={row.index}
                  data-index={row.index}
                  ref={virtualizer.measureElement}
                  value={model}
                  aria-label={modelDescription(model, capabilities)}
                  styles={styles.row(row.start)}
                >
                  <span {...stylex.props(styles.modelDetails)}>
                    <span {...stylex.props(styles.modelHeading)}>
                      <span {...stylex.props(styles.modelName)}>{model.name}</span>
                      <ModelCapabilityIcons capabilities={capabilities} />
                    </span>
                    <span {...stylex.props(styles.modelMetadata)}>{pricingLabel(model)}</span>
                  </span>
                </Combobox.Item>
              );
            })}
          </Combobox.List>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar />
    </ScrollArea.Root>
  );
}

function modelLabel(model: ModelOption) {
  return model.name;
}

function equalModels(left: ModelOption, right: ModelOption) {
  return sameModel(left.reference, right.reference);
}

function filterModel(model: ModelOption, query: string) {
  const searchable = `${model.name} ${model.publisher.name} ${model.reference.modelId} ${model.providerDisplayName}`;
  return searchable.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function modelOptions(
  catalogs: ReadonlyArray<ProviderModelCatalog>,
  selectedReference: ModelReference | null,
) {
  const groups: ModelGroup[] = [];
  let selected: ModelOption | null = null;

  for (const catalog of catalogs) {
    if (catalog.state.status !== "available" || catalog.state.models.length === 0) continue;
    const items = catalog.state.models.map((model): ModelOption => ({
      ...model,
      providerDisplayName: catalog.displayName,
    }));
    groups.push({
      id: catalog.providerId,
      label: catalog.displayName,
      items,
    });
    if (!selectedReference || selected) continue;
    const match = items.find((model) => sameModel(model.reference, selectedReference));
    if (match) selected = match;
  }

  if (!selected && selectedReference) {
    const provider = catalogs.find(
      (catalog) => catalog.providerId === selectedReference.providerId,
    );
    let providerDisplayName = selectedReference.providerId;
    if (provider) providerDisplayName = provider.displayName;
    selected = {
      reference: selectedReference,
      name: selectedReference.modelId,
      publisher: { id: selectedReference.providerId, name: providerDisplayName },
      pricing: null,
      capabilities: null,
      providerDisplayName,
    };
  }

  return { groups, selected };
}

function sameModel(left: ModelReference, right: ModelReference) {
  return left.providerId === right.providerId && left.modelId === right.modelId;
}

function ModelValue({ model }: { model: ModelOption }) {
  return (
    <span {...stylex.props(styles.value)}>
      <ProviderIcon providerId={model.reference.providerId} />
      <span {...stylex.props(styles.valueName)}>{model.name}</span>
    </span>
  );
}

function visibleCapabilities(capabilities: Model["capabilities"] | null) {
  const visible: Capability[] = [];
  if (!capabilities) return visible;
  if (capabilities.inputModalities?.includes("image")) visible.push("image");
  if (capabilities.inputModalities?.includes("video")) visible.push("video");
  if (capabilities.inputModalities?.includes("audio")) visible.push("audio");
  if (capabilities.reasoning === true) visible.push("reasoning");
  return visible;
}

function modelDescription(model: ModelOption, capabilities: ReadonlyArray<Capability>) {
  const labels = capabilities.map((capability) => capabilityIcons[capability].label);
  return [model.name, ...labels, pricingLabel(model)].join(", ");
}

function ModelCapabilityIcons({ capabilities }: { capabilities: ReadonlyArray<Capability> }) {
  if (capabilities.length === 0) return null;

  return (
    <span {...stylex.props(styles.capabilityList)}>
      {capabilities.map((capability) => {
        const { Icon, label } = capabilityIcons[capability];
        return (
          <Tooltip.Root key={capability}>
            <Tooltip.Trigger
              render={
                <span
                  aria-hidden="true"
                  data-capability={capability}
                  {...stylex.props(styles.capabilityIcon)}
                />
              }
            >
              <Icon aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Popup>{label}</Tooltip.Popup>
          </Tooltip.Root>
        );
      })}
    </span>
  );
}

function modelKey(model: ModelOption) {
  return `${model.reference.providerId}\u0000${model.reference.modelId}`;
}

const price = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

function pricingLabel(model: ModelOption) {
  if (!model.pricing) return "Pricing unavailable";
  const input = price.format(model.pricing.inputPerMillionTokens);
  const output = price.format(model.pricing.outputPerMillionTokens);
  return `In ${input}/Mtok · Out ${output}/Mtok`;
}

const styles = stylex.create({
  trigger: { inlineSize: "100%", minInlineSize: 0 },
  triggerContent: {
    display: "flex",
    alignItems: "center",
    flexGrow: 1,
    minInlineSize: 0,
    textAlign: "start",
  },
  triggerIndicator: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    inlineSize: control.iconSize,
    blockSize: control.iconSize,
    opacity: 0.65,
  },
  placeholder: { color: colors.textMuted, fontWeight: fonts.regular },
  popup: {
    inlineSize: "min(42rem, var(--available-width))",
    minInlineSize: "min(var(--anchor-width), var(--available-width))",
    blockSize: "min(28rem, var(--available-height))",
  },
  tabLayout: {
    display: "grid",
    gridTemplateColumns: "3rem minmax(0, 1fr)",
    inlineSize: "100%",
    blockSize: "100%",
    minBlockSize: 0,
  },
  rail: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: space[1],
    minBlockSize: 0,
    padding: space[2],
    borderInlineEndWidth: 1,
    borderInlineEndStyle: "solid",
    borderInlineEndColor: colors.divider,
  },
  modelPane: {
    display: "flex",
    flexDirection: "column",
    inlineSize: "100%",
    minInlineSize: 0,
    minBlockSize: 0,
    overflow: "hidden",
  },
  list: (blockSize: number) => ({ blockSize }),
  row: (start: number) => ({
    position: "absolute",
    insetBlockStart: 0,
    insetInline: space[1],
    transform: `translateY(${start}px)`,
  }),
  value: {
    display: "flex",
    alignItems: "center",
    gap: space[3],
    minInlineSize: 0,
  },
  valueName: {
    display: "block",
    overflow: "hidden",
    minInlineSize: 0,
    color: colors.text,
    fontWeight: fonts.medium,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  modelDetails: {
    display: "flex",
    flexDirection: "column",
    inlineSize: "100%",
    minInlineSize: 0,
  },
  modelHeading: {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    inlineSize: "100%",
    minInlineSize: 0,
  },
  modelName: {
    display: "block",
    flexGrow: 1,
    minInlineSize: 0,
    overflow: "hidden",
    color: colors.text,
    fontWeight: fonts.medium,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  capabilityList: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0,
    gap: space[1],
  },
  capabilityIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    inlineSize: space[5],
    blockSize: space[5],
    color: {
      default: colors.textMuted,
      '[data-capability="image"]': colors.capabilityImage,
      '[data-capability="video"]': colors.capabilityVideo,
      '[data-capability="audio"]': colors.capabilityAudio,
      '[data-capability="reasoning"]': colors.capabilityReasoning,
    },
  },
  modelMetadata: {
    display: "block",
    overflow: "hidden",
    color: colors.textMuted,
    fontWeight: fonts.regular,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
