import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@stargeist/ui";
import type { WorkspaceId } from "@stargeist/domain";
import { useNavigate } from "@tanstack/react-router";
import { canRetryFailure, failureMessage } from "#src/client/index.ts";
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
      <Button
        appearance="ghost"
        onClick={() => void chooseFolder()}
        disabled={disabled}
        aria-busy={creation.waiting}
      >
        Add library
      </Button>
      {creation._tag === "Failure" && <p role="alert">{failureMessage(creation.cause)}</p>}
    </>
  );
}
