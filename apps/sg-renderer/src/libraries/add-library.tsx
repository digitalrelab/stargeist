import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@stargeist/ui";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import { useNavigate } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/rpc/index.ts";
import { useLibraryState } from "./use-state";

export function AddLibrary({ workspaceId }: { workspaceId: WorkspaceId }) {
  const state = useLibraryState();
  const operation = state.addLibrary(workspaceId);
  const creation = useAtomValue(operation);
  const add = useAtomSet(operation, { mode: "promiseExit" });
  const navigate = useNavigate();

  const disabled =
    creation.waiting || (creation._tag === "Failure" && !canRetryFailure(creation.cause));

  const chooseFolder = async () => {
    if (disabled) return;

    const result = await add(undefined);

    if (result._tag !== "Success" || !result.value) return;

    await navigate({
      to: "/workspaces/$workspaceId/libraries/$libraryId",
      params: { workspaceId, libraryId: result.value.id },
    });
  };

  return (
    <>
      <Button onClick={() => void chooseFolder()} disabled={disabled}>
        {creation.waiting ? "Choosing folder…" : "Add library"}
      </Button>
      {creation._tag === "Failure" && <p role="alert">{failureMessage(creation.cause)}</p>}
    </>
  );
}
