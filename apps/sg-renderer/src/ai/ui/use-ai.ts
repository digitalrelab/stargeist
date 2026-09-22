import { useRouteContext } from "@tanstack/react-router";

export const useAgentModels = () =>
  useRouteContext({
    from: "__root__",
    select: ({ application }) => application.ai.agentModels,
  });

export const useProviderConnections = () =>
  useRouteContext({
    from: "__root__",
    select: ({ application }) => application.ai.providerConnections,
  });
