import { LibraryError } from "@stargeist/domain/libraries";
import { LibraryDialogRpcs } from "@stargeist/domain/libraries/rpc";
import { reportFailure } from "@stargeist/std/errors";
import type { WebContents } from "electron";
import { Cause, Effect } from "effect";
import type { LibraryControlClient } from "./control";
import { chooseFolder } from "../filesystem/host";

export const libraryDialogHandlers = (contents: WebContents, client: LibraryControlClient) =>
  LibraryDialogRpcs.toLayer({
    "libraries.add": ({ workspaceId }) =>
      Effect.gen(function* () {
        const path = yield* chooseFolder(contents, "Add library").pipe(
          Effect.onError((cause) => reportFailure("libraries.dialog.open", cause)),
          Effect.mapError(
            () =>
              new LibraryError({
                code: "FolderUnavailable",
                message: "The folder picker could not be opened.",
              }),
          ),
        );

        if (!path) return null;

        return yield* client["libraries.add"]({ workspaceId, path }).pipe(
          Effect.catchTag("RpcClientError", (error) =>
            reportFailure("libraries.dialog.save", Cause.fail(error)).pipe(
              Effect.andThen(
                Effect.fail(
                  new LibraryError({
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
