import { useAtomValue } from "@effect/atom-react";
import { colors } from "@stargeist/ui/colors.stylex";
import { space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, use, useMemo, type ReactNode } from "react";
import { failureMessage } from "#src/rpc/index.ts";
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
  const startup = useAtomValue(state.runtime);

  if (startup._tag !== "Success") {
    return (
      <main {...stylex.props(styles.status)}>
        <p role={startup._tag === "Failure" ? "alert" : "status"}>
          {startup._tag === "Failure" ? failureMessage(startup.cause) : "Opening workspaces…"}
        </p>
      </main>
    );
  }

  return <WorkspaceContext value={state}>{children}</WorkspaceContext>;
}

export function useWorkspaceState() {
  const state = use(WorkspaceContext);

  if (!state) throw new Error("WorkspaceProvider is required");

  return state;
}

const styles = stylex.create({ status: { padding: space[8], color: colors.textMuted } });
