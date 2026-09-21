import { WorkspaceError } from "@stargeist/domain/workspaces";
import { WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
import { reportFailure } from "@stargeist/std/errors";
import { BrowserWindow, dialog, type WebContents } from "electron";
import { Cause, Effect } from "effect";
import type { RpcClient, RpcClientError } from "effect/unstable/rpc";
import { WorkspaceControlRpcs } from "./control";

export { WorkspaceDialogRpcs } from "@stargeist/domain/workspaces/rpc";
export { WorkspaceControlRpcs } from "./control";

export type WorkspaceControlClient = RpcClient.FromGroup<
  typeof WorkspaceControlRpcs,
  RpcClientError.RpcClientError
>;

export const workspaceDialogHandlers = (contents: WebContents, client: WorkspaceControlClient) =>
  WorkspaceDialogRpcs.toLayer({
    create: () =>
      Effect.gen(function* () {
        const window = BrowserWindow.fromWebContents(contents);

        if (!window) return null;

        const result = yield* Effect.tryPromise(() =>
          dialog.showOpenDialog(window, {
            title: "Create workspace",
            buttonLabel: "Use folder",
            properties: ["openDirectory"],
          }),
        ).pipe(
          Effect.onError((cause) => reportFailure("workspaces.dialog.open", cause)),
          Effect.mapError(
            () =>
              new WorkspaceError({
                code: "FolderUnavailable",
                message: "The folder picker could not be opened.",
              }),
          ),
        );

        const path = result.filePaths[0];

        if (result.canceled || !path) return null;

        return yield* client.register({ path }).pipe(
          Effect.catchTag("RpcClientError", (error) =>
            reportFailure("workspaces.dialog.register", Cause.fail(error)).pipe(
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
