import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import { Button, Select, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useNavigate } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "./use-state";

export function WorkspaceSwitcher({ workspaceId }: { workspaceId: WorkspaceId | undefined }) {
  const { workspaces } = useWorkspaceState();
  const list = useAtomValue(workspaces);
  const refresh = useAtomRefresh(workspaces);
  const navigate = useNavigate();

  let items: Array<{ value: WorkspaceId; label: string }> = [];
  let placeholder = "Loading workspaces…";

  if (list._tag === "Success") {
    items = list.value.map((workspace) => ({
      value: workspace.id,
      label: workspace.displayName,
    }));
    placeholder = "Select workspace";

    if (items.length === 0) placeholder = "No workspaces yet";
  }

  if (list._tag === "Failure") placeholder = "Workspaces unavailable";

  return (
    <div {...stylex.props(styles.switcher)}>
      <Select
        aria-label="Workspace"
        aria-busy={list.waiting}
        items={items}
        value={workspaceId}
        placeholder={placeholder}
        onValueChange={(id) => {
          void navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: id } });
        }}
      />
      {list._tag === "Failure" && (
        <>
          <p {...stylex.props(styles.error, typography.label)} role="alert">
            {failureMessage(list.cause)}
          </p>
          {canRetryFailure(list.cause) && (
            <Button appearance="ghost" size="sm" onClick={refresh} disabled={list.waiting}>
              Retry
            </Button>
          )}
        </>
      )}
    </div>
  );
}

const styles = stylex.create({
  switcher: { display: "flex", flexDirection: "column", gap: space[2], minWidth: 0 },
  error: { color: colors.textMuted, overflowWrap: "anywhere" },
});
