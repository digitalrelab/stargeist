import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import { AISettingsPage } from "#src/ai/index.ts";

export const Route = createFileRoute("/settings/ai")({
  codeSplitGroupings: [["component", "pendingComponent"]],
  component: AISettingsPage,
  pendingComponent: AISettingsPage,
  loader: ({ context }) => {
    const connections = AtomRegistry.getResult(
      context.registry,
      context.application.ai.providerConnections.list,
      { suspendOnWaiting: true },
    ).pipe(Effect.ignore);
    const catalogs = AtomRegistry.getResult(
      context.registry,
      context.application.ai.agentModels.catalogs,
      { suspendOnWaiting: true },
    ).pipe(Effect.ignore);
    const defaultModel = AtomRegistry.getResult(
      context.registry,
      context.application.ai.agentModels.defaultModel,
      { suspendOnWaiting: true },
    ).pipe(Effect.ignore);

    return Effect.runPromise(
      Effect.all([connections, catalogs, defaultModel], { concurrency: "unbounded" }),
    );
  },
  staticData: { breadcrumb: { label: "AI" } },
});
