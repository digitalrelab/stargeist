import { AIIcon, IconBadge } from "@stargeist/ui";
import type { ComponentType } from "react";
import type { ProviderConnectionOperation } from "../state";
import { APIKeyForm } from "../ui/api-key-form";
import { OpenRouterIcon } from "./openrouter";

const providers: Partial<
  Record<
    string,
    {
      Icon: ComponentType;
      Editor?: ComponentType<{
        operation: ProviderConnectionOperation;
        summary: string | null;
        onClose: () => void;
      }>;
    }
  >
> = {
  openrouter: { Icon: OpenRouterIcon, Editor: APIKeyForm },
};

export function providerEditor(providerId: string) {
  return providers[providerId]?.Editor;
}

export function ProviderIcon({ providerId }: { providerId: string }) {
  const Icon = providers[providerId]?.Icon;

  if (Icon) return <Icon />;

  return <AIIcon aria-hidden="true" />;
}

export function ProviderBadge({ providerId }: { providerId: string }) {
  return (
    <IconBadge aria-hidden="true">
      <ProviderIcon providerId={providerId} />
    </IconBadge>
  );
}
