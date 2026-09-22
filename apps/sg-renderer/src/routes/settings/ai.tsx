import { createFileRoute } from "@tanstack/react-router";
import { ProvidersSection } from "#src/ai/index.ts";

export const Route = createFileRoute("/settings/ai")({
  component: ProvidersSection,
  staticData: { breadcrumb: { label: "AI" } },
});
