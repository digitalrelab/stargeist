import { realpath, stat } from "node:fs/promises";
import { basename, parse } from "node:path";
import { WorkspaceError } from "@stargeist/domain/workspaces";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";

export const selectedFolder = (path: string) =>
  Effect.tryPromise(async () => {
    const rootPath = await realpath(path);
    const info = await stat(rootPath, { bigint: true });

    if (!info.isDirectory()) throw new Error("Not a directory");

    return {
      rootPath,
      name: basename(rootPath) || parse(rootPath).root,
      identity: info.ino !== 0n ? `${info.dev}:${info.ino}` : rootPath,
    };
  }).pipe(
    Effect.onError((cause) => reportFailure("workspaces.folder.resolve", cause)),
    Effect.mapError(
      () =>
        new WorkspaceError({
          code: "FolderUnavailable",
          message:
            "This folder is unavailable or cannot be read. Check its location and permissions.",
        }),
    ),
  );
