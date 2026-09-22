import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { opendir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  type DirectoryPage,
  type FileType,
  DirectorySessionId,
  DirectoryError,
  directoryPageSize,
  Files,
} from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema, Semaphore } from "effect";
import { TemporaryStorage } from "@stargeist/storage";
import mime from "mime";
import { openDirectoryCache } from "./directory-cache";

const expired = () =>
  new DirectoryError({
    code: "DirectorySessionExpired",
    message: "This folder view has expired. Refresh to reopen it.",
  });

const unavailable = () =>
  new DirectoryError({
    code: "FolderUnavailable",
    message: "The folder could not be read. Check its location and permissions, then refresh.",
  });

function fileType(entry: Dirent): FileType {
  if (entry.isDirectory()) return "folder";
  if (entry.isFile()) return "file";
  if (entry.isSymbolicLink()) return "link";
  return "other";
}

export const openDirectorySession = Effect.fnUntraced(function* (
  rootPath: string,
  options?: { readonly exclude: ReadonlySet<string> },
) {
  const temporaryStorage = yield* TemporaryStorage;
  const files = yield* Files;
  const directorySessionId = Schema.decodeUnknownSync(DirectorySessionId)(randomUUID());
  const filename = join(
    temporaryStorage.directory,
    `directory-session-${directorySessionId}.sqlite`,
  );
  const cache = yield* openDirectoryCache(filename);
  const root = yield* Effect.tryPromise(() => realpath(rootPath)).pipe(
    Effect.mapError(unavailable),
  );
  const initial = yield* Effect.tryPromise(() => stat(root, { bigint: true })).pipe(
    Effect.mapError(unavailable),
  );
  if (!initial.isDirectory()) return yield* unavailable();

  const validateRoot = Effect.tryPromise(() => stat(root, { bigint: true })).pipe(
    Effect.mapError(expired),
    Effect.flatMap((current) => {
      if (current.dev !== initial.dev || current.ino !== initial.ino) return Effect.fail(expired());
      return Effect.void;
    }),
  );

  const directory = yield* Effect.acquireRelease(
    Effect.tryPromise(() => opendir(root, { bufferSize: directoryPageSize })).pipe(
      Effect.onError((cause) => reportFailure("directories.open", cause)),
      Effect.mapError(unavailable),
    ),
    (directory) => Effect.promise(() => directory.close()),
  );

  let complete = false;
  let pending: Dirent[] = [];

  const readNext = Effect.gen(function* () {
    const entry = yield* Effect.tryPromise(() => directory.read()).pipe(
      Effect.onError((cause) => reportFailure("directories.read", cause)),
      Effect.mapError(unavailable),
    );
    if (!entry) {
      complete = true;
      return;
    }
    if (!options?.exclude.has(entry.name)) pending.push(entry);
  }).pipe(Effect.uninterruptible);

  const read = Effect.fnUntraced(function* (offset: number) {
    if (offset < 0 || offset > cache.committedCount || offset % directoryPageSize !== 0) {
      return yield* Effect.fail(expired());
    }

    const lookahead = offset + directoryPageSize + 1;
    while ((!complete || pending.length > 0) && cache.totalCount < lookahead) {
      yield* validateRoot;
      while (!complete && pending.length < lookahead - cache.totalCount) yield* readNext;

      const identities = yield* files
        .ensure(pending.map((entry) => ({ source: "local", key: join(root, entry.name) })))
        .pipe(
          Effect.mapError(
            (error) => new DirectoryError({ code: error.code, message: error.message }),
          ),
        );
      yield* validateRoot;
      for (const [index, entry] of pending.entries()) {
        const type = fileType(entry);
        let mediaType: string | null = null;
        if (type === "file" && entry.name.lastIndexOf(".") > 0) {
          mediaType = mime.getType(entry.name);
        }
        cache.append({ id: identities[index]!.id, name: entry.name, type, mediaType });
      }
      pending = [];
    }

    const page = yield* cache.read(offset);
    return {
      directorySessionId,
      offset,
      files: page,
      hasMore: !complete || cache.committedCount > offset + page.length,
    } satisfies DirectoryPage;
  });

  const lock = yield* Semaphore.make(1);
  const firstPage = yield* read(0);
  return { directorySessionId, firstPage, read: (offset: number) => lock.withPermit(read(offset)) };
});
