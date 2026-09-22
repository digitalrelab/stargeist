import { randomUUID } from "node:crypto";
import { opendir } from "node:fs/promises";
import { join } from "node:path";
import {
  type DirectoryListingPage,
  ListingId,
  DirectoryError,
  directoryPageSize,
  Files,
} from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema, Semaphore } from "effect";
import { TemporaryStorage } from "../storage";
import { openDirectoryCache } from "@stargeist/database/filesystem";
import { observeFile } from "./observation";

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

export const openListing = Effect.fnUntraced(function* (
  rootPath: string,
  options?: { readonly exclude: ReadonlySet<string> },
) {
  const temporaryStorage = yield* TemporaryStorage;
  const fileService = yield* Files;
  const listingId = Schema.decodeUnknownSync(ListingId)(randomUUID());
  const filename = join(temporaryStorage.directory, `directory-listing-${listingId}.sqlite`);
  const cache = yield* openDirectoryCache(filename);
  const root = yield* observeFile(rootPath, ".");
  if (root?.type !== "folder") return yield* unavailable();

  let invalidated = false;
  const validateRoot = Effect.gen(function* () {
    if (invalidated) return yield* expired();
    const current = yield* observeFile(rootPath, ".");
    if (current?.objectKey !== root.objectKey) {
      invalidated = true;
      return yield* expired();
    }
  });

  const directory = yield* Effect.acquireRelease(
    Effect.tryPromise(() => opendir(rootPath, { bufferSize: directoryPageSize })).pipe(
      Effect.onError((cause) => reportFailure("directories.open", cause)),
      Effect.mapError(unavailable),
    ),
    (directory) => Effect.promise(() => directory.close()),
  );

  let complete = false;
  let pendingNames: string[] = [];

  const readNext = Effect.gen(function* () {
    const file = yield* Effect.tryPromise(() => directory.read()).pipe(
      Effect.onError((cause) => reportFailure("directories.read", cause)),
      Effect.mapError(unavailable),
    );

    if (!file) {
      complete = true;
      return;
    }

    if (!options?.exclude.has(file.name)) {
      pendingNames.push(file.name);
    }
  }).pipe(Effect.uninterruptible);

  const read = Effect.fnUntraced(function* (offset: number) {
    if (offset < 0 || offset > cache.committedCount || offset % directoryPageSize !== 0) {
      return yield* Effect.fail(expired());
    }

    const lookahead = offset + directoryPageSize + 1;

    while ((!complete || pendingNames.length > 0) && cache.totalCount < lookahead) {
      yield* validateRoot;
      while (!complete && pendingNames.length < lookahead - cache.totalCount) {
        yield* readNext;
      }

      const observations = yield* Effect.forEach(
        pendingNames,
        (name) => observeFile(rootPath, name),
        { concurrency: 8 },
      );
      const present = observations.filter((file) => file !== null);
      yield* validateRoot;

      yield* Effect.gen(function* () {
        const files = yield* fileService
          .remember(present)
          .pipe(
            Effect.mapError(
              (error) => new DirectoryError({ code: error.code, message: error.message }),
            ),
          );
        for (const file of files) cache.append(file);
        pendingNames = [];
      }).pipe(Effect.uninterruptible);
    }

    const files = yield* cache.read(offset);

    return {
      listingId,
      offset,
      files,
      hasMore: !complete || cache.committedCount > offset + files.length,
    } satisfies DirectoryListingPage;
  });

  const lock = yield* Semaphore.make(1);
  const firstPage = yield* read(0);

  return { listingId, firstPage, read: (offset: number) => lock.withPermit(read(offset)) };
});
