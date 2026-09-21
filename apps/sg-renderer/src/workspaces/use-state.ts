import { useRouteContext } from "@tanstack/react-router";

export const useWorkspaceState = () =>
  useRouteContext({ from: "__root__", select: ({ application }) => application.workspaces });
