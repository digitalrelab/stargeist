import { AIIcon, IconBadge } from "@stargeist/ui";
import type { ComponentType } from "react";
import { OpenRouterBadge } from "./openrouter";

const providerBadges: Partial<Record<string, ComponentType>> = {
  openrouter: OpenRouterBadge,
};

export function ProviderBadge({ providerId }: { providerId: string }) {
  const Badge = providerBadges[providerId];

  if (Badge) return <Badge />;

  return (
    <IconBadge aria-hidden="true">
      <AIIcon />
    </IconBadge>
  );
}
