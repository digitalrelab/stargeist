import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@stargeist/ui";
import { useNavigate } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useWorkspaceState } from "./use-state";

export function CreateWorkspace() {
  const state = useWorkspaceState();
  const operation = state.createWorkspace;
  const creation = useAtomValue(operation);
  const create = useAtomSet(operation, { mode: "promiseExit" });
  const navigate = useNavigate();

  const disabled =
    creation.waiting || (creation._tag === "Failure" && !canRetryFailure(creation.cause));

  const chooseFolder = async () => {
    if (disabled) return;

    const result = await create(undefined);

    if (result._tag !== "Success" || !result.value) return;

    await navigate({
      to: "/workspaces/$workspaceId/libraries/$libraryId",
      params: { workspaceId: result.value.workspace.id, libraryId: result.value.library.id },
    });
  };

  return (
    <>
      <Button onClick={() => void chooseFolder()} disabled={disabled} aria-busy={creation.waiting}>
        Create workspace
      </Button>
      {creation._tag === "Failure" && <p role="alert">{failureMessage(creation.cause)}</p>}
    </>
  );
}
