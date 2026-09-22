import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button, Select, Skeleton, typography } from "@stargeist/ui";
import { colors, space } from "@stargeist/ui/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
import { useWorkspaceState } from "./use-state";

export function WorkspaceSwitcher({ workspaceId }: { workspaceId: WorkspaceId | undefined }) {
  const { workspaces } = useWorkspaceState();
  const list = useAtomValue(workspaces);
  const refresh = useAtomRefresh(workspaces);
  const navigate = useNavigate();

  let items: Array<{ value: WorkspaceId; label: string }> = [];
  let placeholder: ReactNode = <Skeleton styles={styles.nameSkeleton} />;

  if (list._tag === "Success") {
    items = list.value.map((workspace) => ({
      value: workspace.id,
      label: workspace.displayName,
    }));
    placeholder = "Select workspace";

    if (items.length === 0) {
      placeholder = "No workspaces yet";
    }
  }

  if (list._tag === "Failure") {
    placeholder = "Workspaces unavailable";
  }

  const selected = items.find((item) => item.value === workspaceId);

  return (
    <div {...stylex.props(styles.switcher)}>
      <Select.Root<WorkspaceId>
        items={items}
        value={selected?.value ?? null}
        disabled={items.length === 0}
        onValueChange={(id) => {
          if (id === null) {
            return;
          }

          void navigate({ to: "/workspaces/$workspaceId", params: { workspaceId: id } });
        }}
      >
        <Select.Trigger aria-label="Workspace" aria-busy={list.waiting}>
          <Select.Value placeholder={placeholder} title={selected?.label} />
        </Select.Trigger>
        <Select.Popup>
          {items.map((item) => (
            <Select.Item key={item.value} value={item.value} title={item.label}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Root>
      {list._tag === "Failure" && (
        <>
          <p {...stylex.props(styles.error, typography.label)} role="alert">
            {failureMessage(list.cause)}
          </p>
          {canRetryFailure(list.cause) && (
            <Button appearance="ghost" onClick={refresh} disabled={list.waiting}>
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
  nameSkeleton: { inlineSize: "7rem", blockSize: space[3] },
  error: { color: colors.textMuted, overflowWrap: "anywhere" },
});
