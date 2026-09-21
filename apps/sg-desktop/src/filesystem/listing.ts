import { randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { opendir } from "node:fs/promises";
import { join } from "node:path";
import {
  type FileSystemEntry,
  type DirectoryListingPage,
  ListingId,
  DirectoryError,
  entryPageSize,
} from "@stargeist/domain/filesystem";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema, Semaphore } from "effect";
import { TemporaryStorage } from "../storage";
import { openDirectoryCache } from "@stargeist/database/filesystem";

const expired = () =>
  new DirectoryError({
    code: "ListingExpired",
    message: "This folder view has expired. Refresh to reopen it.",
  });

const unavailable = () =>
  new DirectoryError({
    code: "FolderUnavailable",
    message: "The folder could not be read. Check its location and permissions, then refresh.",
  });

function entryKind(entry: Dirent): FileSystemEntry["kind"] {
  if (entry.isDirectory()) return "directory";
  if (entry.isFile()) return "file";
  if (entry.isSymbolicLink()) return "symlink";

  return "other";
}

export const openListing = Effect.fnUntraced(function* (rootPath: string) {
  const temporaryStorage = yield* TemporaryStorage;
  const listingId = Schema.decodeUnknownSync(ListingId)(randomUUID());
  const filename = join(temporaryStorage.directory, `directory-listing-${listingId}.sqlite`);
  const cache = yield* openDirectoryCache(filename);

  const directory = yield* Effect.acquireRelease(
    Effect.tryPromise(() => opendir(rootPath, { bufferSize: entryPageSize })).pipe(
      Effect.onError((cause) => reportFailure("directories.open", cause)),
      Effect.mapError(unavailable),
    ),
    (directory) => Effect.promise(() => directory.close()),
  );

  let complete = false;

  const readNext = Effect.gen(function* () {
    const entry = yield* Effect.tryPromise(() => directory.read()).pipe(
      Effect.onError((cause) => reportFailure("directories.read", cause)),
      Effect.mapError(unavailable),
    );

    if (!entry) {
      complete = true;
      return;
    }

    cache.append({ name: entry.name, kind: entryKind(entry) });
  }).pipe(Effect.uninterruptible);

  const read = Effect.fnUntraced(function* (offset: number) {
    if (offset < 0 || offset > cache.committedCount || offset % entryPageSize !== 0) {
      return yield* Effect.fail(expired());
    }

    const lookahead = offset + entryPageSize + 1;

    while (!complete && cache.totalCount < lookahead) {
      yield* readNext;
    }

    const entries = yield* cache.read(offset);

    return {
      listingId,
      offset,
      entries,
      hasMore: !complete || cache.committedCount > offset + entries.length,
    } satisfies DirectoryListingPage;
  });

  const lock = yield* Semaphore.make(1);
  const firstPage = yield* read(0);

  return { listingId, firstPage, read: (offset: number) => lock.withPermit(read(offset)) };
});
