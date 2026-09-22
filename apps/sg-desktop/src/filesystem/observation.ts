import { join } from "node:path";
import { DirectoryError, type FileObservation } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";
import mime from "mime";
import { IdentityUnavailable, readFileIdentity } from "./identity";

export const observeFile = Effect.fnUntraced(
  function* (directory: string, name: string) {
    const info = yield* Effect.tryPromise({
      try: () => readFileIdentity(join(directory, name)),
      catch: (error) => error,
    });
    if (info === null) return null;
    const { type } = info;
    let mediaType: string | null = null;
    if (type === "file" && name.lastIndexOf(".") > 0) mediaType = mime.getType(name);

    return {
      source: "local",
      objectKey: info.objectKey,
      evidence: info.evidence,
      name,
      type,
      mediaType,
    } satisfies FileObservation;
  },
  Effect.onError((cause) => reportFailure("files.observe", cause)),
  Effect.mapError((error) => {
    if (error instanceof IdentityUnavailable) {
      return new DirectoryError({ code: "IdentityUnavailable", message: error.message });
    }
    return new DirectoryError({
      code: "FolderUnavailable",
      message: "The file could not be inspected. Check its location and permissions, then refresh.",
    });
  }),
);
