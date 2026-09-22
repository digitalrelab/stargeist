import { useRouteContext } from "@tanstack/react-router";

export const useAIProviderConnectionsState = () =>
  useRouteContext({
    from: "__root__",
    select: ({ application }) => application.aiProviderConnections,
  });
