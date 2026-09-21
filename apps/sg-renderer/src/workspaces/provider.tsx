import { RegistryProvider } from "@effect/atom-react";
import { createContext, use, useMemo, type ReactNode } from "react";
import type { WorkspacesClient } from "./client";
import { createWorkspaceState, type WorkspaceState } from "./state";

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({
  client,
  children,
}: {
  client: WorkspacesClient["Service"];
  children: ReactNode;
}) {
  const state = useMemo(() => createWorkspaceState(client), [client]);
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
