import { realpath, stat } from "node:fs/promises";
import { basename, parse } from "node:path";
import { LibraryError } from "@stargeist/domain/libraries";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";

export const selectedFolder = (path: string) =>
  Effect.tryPromise(async () => {
    const rootPath = await realpath(path);
    const info = await stat(rootPath);

    if (!info.isDirectory()) throw new Error("Not a directory");

    return {
      source: { kind: "local-fs" as const, path: rootPath },
      displayName: basename(rootPath) || parse(rootPath).root,
    };
  }).pipe(
    Effect.onError((cause) => reportFailure("libraries.folder.resolve", cause)),
    Effect.mapError(
      () =>
        new LibraryError({
          code: "FolderUnavailable",
          message:
            "This folder is unavailable or cannot be read. Check its location and permissions.",
        }),
    ),
  );
