import * as RpcEndpoint from "@stargeist/application/rpc";
import { WorkspaceError } from "@stargeist/domain";
import { WorkspaceDialogRpcs } from "@stargeist/protocol/workspaces";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";
import { FolderPicker } from "../filesystem/dialogs";
import { WorkspaceCommands } from "./control";

export const WorkspaceDialogsEndpoint = RpcEndpoint.define(WorkspaceDialogRpcs)({
  concurrency: 1,
  implementation: Effect.gen(function* () {
    const picker = yield* FolderPicker;
    const commands = yield* WorkspaceCommands;
    const choose = Effect.fnUntraced(function* <A>(
      title: string,
      operation: (path: string) => Effect.Effect<A, WorkspaceError>,
    ) {
      const path = yield* picker.choose(title).pipe(
        Effect.onError((cause) => reportFailure("workspaces.dialog", cause)),
        Effect.mapError(
          () =>
            new WorkspaceError({
              code: "FolderPickerUnavailable",
              message: "The folder picker could not be opened. Try again.",
            }),
        ),
      );
      if (path === null) return null;
      return yield* operation(path);
    });
    return {
      "workspaces.openFromFolder": () => choose("Open folder", commands.open),
      "workspaces.initializeFromFolder": () =>
        choose("Initialize workspace in folder", commands.initialize),
      "workspaces.reconnectFromFolder": ({ id }) =>
        choose("Locate workspace", (path) => commands.reconnect(id, path)),
    };
  }),
});

export { WorkspaceCommands, workspaceCommandsLayer } from "./control";
