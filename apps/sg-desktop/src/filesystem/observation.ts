import type { BigIntStats } from "node:fs";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { DirectoryError, type FileObservation, type FileType } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";
import mime from "mime";

function fileType(info: BigIntStats): FileType {
  if (info.isDirectory()) return "folder";
  if (info.isFile()) return "file";
  if (info.isSymbolicLink()) return "link";
  return "other";
}

export const observeFile = Effect.fnUntraced(
  function* (directory: string, name: string) {
    const info = yield* Effect.tryPromise(async () => {
      try {
        return await lstat(join(directory, name), { bigint: true });
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
        throw error;
      }
    });
    if (info === null) return null;

    if (info.ino <= 0n || info.birthtimeNs <= 0n) {
      return yield* new DirectoryError({
        code: "IdentityUnavailable",
        message:
          "This filesystem does not provide the object identity information needed to track files safely.",
      });
    }

    const type = fileType(info);
    let mediaType: string | null = null;
    if (type === "file" && name.lastIndexOf(".") > 0) mediaType = mime.getType(name);

    return {
      source: "local",
      objectKey: `${info.dev}:${info.ino}:${info.birthtimeNs}`,
      name,
      type,
      mediaType,
    } satisfies FileObservation;
  },
  Effect.onError((cause) => reportFailure("files.observe", cause)),
  Effect.mapError((error) => {
    if (error instanceof DirectoryError) return error;
    return new DirectoryError({
      code: "FolderUnavailable",
      message: "The file could not be inspected. Check its location and permissions, then refresh.",
    });
  }),
);
