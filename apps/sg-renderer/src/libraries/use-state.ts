import { useRouteContext } from "@tanstack/react-router";

export const useLibraryState = () =>
  useRouteContext({ from: "__root__", select: ({ application }) => application.libraries });
