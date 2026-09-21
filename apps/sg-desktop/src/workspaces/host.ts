import { WorkspaceError } from "@stargeist/domain/workspaces";
import { WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
import { reportFailure } from "@stargeist/std/errors";
import type { WebContents } from "electron";
import { Cause, Effect } from "effect";
import type { WorkspaceControlClient } from "./control";
import { chooseFolder } from "../filesystem/host";

export const workspaceDialogHandlers = (contents: WebContents, client: WorkspaceControlClient) =>
  WorkspaceDialogRpcs.toLayer({
    "workspaces.create": () =>
      Effect.gen(function* () {
        const path = yield* chooseFolder(contents, "Create workspace").pipe(
          Effect.onError((cause) => reportFailure("workspaces.dialog.open", cause)),
          Effect.mapError(
            () =>
              new WorkspaceError({
                code: "FolderUnavailable",
                message: "The folder picker could not be opened.",
              }),
          ),
        );

        if (!path) return null;

        return yield* client["workspaces.create"]({ path }).pipe(
          Effect.catchTag("RpcClientError", (error) =>
            reportFailure("workspaces.dialog.save", Cause.fail(error)).pipe(
              Effect.andThen(
                Effect.fail(
                  new WorkspaceError({
                    code: "StorageUnavailable",
                    message: "The backend connection is unavailable.",
                  }),
                ),
              ),
            ),
          ),
        );
      }),
  });
