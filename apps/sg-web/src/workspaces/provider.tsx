import { RegistryProvider } from "@effect/atom-react";
import { createContext, use, useMemo, type ReactNode } from "react";
import { createWorkspaceState, type WorkspaceClientLayer, type WorkspaceState } from "./state";

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({
  layer,
  children,
}: {
  layer: WorkspaceClientLayer;
  children: ReactNode;
}) {
  const state = useMemo(() => createWorkspaceState(layer), [layer]);
  return (
    <RegistryProvider>
      <WorkspaceContext value={state}>{children}</WorkspaceContext>
    </RegistryProvider>
  );
}

export function useWorkspaceState() {
  const state = use(WorkspaceContext);

  if (!state) throw new Error("WorkspaceProvider is required");

  return state;
}
