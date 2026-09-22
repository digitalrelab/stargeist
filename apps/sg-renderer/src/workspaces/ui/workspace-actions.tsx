import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { WorkspaceId } from "@stargeist/domain";
import { Button } from "@stargeist/ui";
import { useNavigate } from "@tanstack/react-router";
import { failureMessage } from "#src/client/index.ts";
import { useWorkspaceState } from "./use-state";

export function OpenWorkspace({ mode = "open" }: { mode?: "open" | "initialize" }) {
  const operation = useWorkspaceState().openWorkspace(mode);
  const status = useAtomValue(operation);
  const run = useAtomSet(operation, { mode: "promiseExit" });
  const navigate = useNavigate();
  let label = "Open folder…";
  let appearance: "solid" | "ghost" = "solid";
  if (mode === "initialize") {
    label = "Initialize workspace…";
    appearance = "ghost";
  }
  const choose = async () => {
    if (status.waiting) return;
    const result = await run(undefined);
    if (result._tag !== "Success" || !result.value) return;
    await navigate({
      to: "/workspaces/$workspaceId",
      params: { workspaceId: result.value.id },
    });
  };
  return (
    <>
      <Button
        appearance={appearance}
        onClick={() => void choose()}
        disabled={status.waiting}
        aria-busy={status.waiting}
      >
        {label}
      </Button>
      {status._tag === "Failure" && <p role="alert">{failureMessage(status.cause)}</p>}
    </>
  );
}

export function ReconnectWorkspace({ workspaceId }: { workspaceId: WorkspaceId }) {
  const operation = useWorkspaceState().reconnectWorkspace(workspaceId);
  const status = useAtomValue(operation);
  const run = useAtomSet(operation, { mode: "promiseExit" });
  return (
    <>
      <Button
        appearance="ghost"
        onClick={() => void run(undefined)}
        disabled={status.waiting}
        aria-busy={status.waiting}
      >
        Locate folder…
      </Button>
      {status._tag === "Failure" && <p role="alert">{failureMessage(status.cause)}</p>}
    </>
  );
}

export function ForgetWorkspace({ workspaceId }: { workspaceId: WorkspaceId }) {
  const operation = useWorkspaceState().forgetWorkspace;
  const status = useAtomValue(operation);
  const run = useAtomSet(operation, { mode: "promiseExit" });
  const navigate = useNavigate();
  const forget = async () => {
    const result = await run(workspaceId);
    if (result._tag === "Success") await navigate({ to: "/" });
  };
  return (
    <>
      <Button
        appearance="ghost"
        onClick={() => void forget()}
        disabled={status.waiting}
        aria-busy={status.waiting}
      >
        Remove from recent
      </Button>
      {status._tag === "Failure" && <p role="alert">{failureMessage(status.cause)}</p>}
    </>
  );
}
