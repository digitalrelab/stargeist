import {
  Libraries,
  Library,
  LibraryError,
  makeLibraryId,
  type LibrarySelection,
  type AddLibrary,
  type WorkspaceId,
} from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Clock, Effect, Layer, Schema } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../sqlite";
import { libraries } from "./schema";
import { workspaces } from "../workspaces/schema";

const storageError = () =>
  new LibraryError({
    code: "StorageUnavailable",
    message: "Library records could not be read or saved. Try again.",
  });

const notFound = () =>
  new LibraryError({ code: "NotFound", message: "This library is no longer available." });

const libraryColumns = {
  id: libraries.id,
  workspaceId: libraries.workspaceId,
  displayName: libraries.displayName,
  source: { kind: libraries.sourceKind, path: libraries.sourcePath },
  createdAt: libraries.createdAt,
};

const decodeLibraries = Schema.decodeUnknownEffect(Schema.Array(Library));

export const librariesLayer = Layer.effect(
  Libraries,
  Effect.gen(function* () {
    const database = yield* Database;

    const requireWorkspace = Effect.fnUntraced(function* (id: WorkspaceId) {
      const rows = yield* database
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .all()
        .pipe(
          Effect.onError((cause) => reportFailure("libraries.workspace", cause)),
          Effect.mapError(storageError),
        );

      if (rows.length === 0) {
        return yield* Effect.fail(
          new LibraryError({
            code: "NotFound",
            message: "This workspace is no longer available.",
          }),
        );
      }
    });

    const list = Effect.fnUntraced(function* (workspaceId: WorkspaceId) {
      yield* requireWorkspace(workspaceId);

      return yield* database
        .select(libraryColumns)
        .from(libraries)
        .where(eq(libraries.workspaceId, workspaceId))
        .orderBy(libraries.createdAt, libraries.id)
        .all()
        .pipe(
          Effect.flatMap(decodeLibraries),
          Effect.onError((cause) => reportFailure("libraries.list", cause)),
          Effect.mapError(storageError),
        );
    });

    const get = Effect.fnUntraced(function* ({ workspaceId, id }: LibrarySelection) {
      const rows = yield* database
        .select(libraryColumns)
        .from(libraries)
        .where(and(eq(libraries.id, id), eq(libraries.workspaceId, workspaceId)))
        .all()
        .pipe(
          Effect.flatMap(decodeLibraries),
          Effect.onError((cause) => reportFailure("libraries.get", cause)),
          Effect.mapError(storageError),
        );

      const library = rows[0];

      if (!library) {
        return yield* Effect.fail(notFound());
      }

      return library;
    });

    const add = Effect.fnUntraced(function* ({ workspaceId, source, displayName }: AddLibrary) {
      const now = yield* Clock.currentTimeMillis;
      yield* requireWorkspace(workspaceId);

      const id = yield* makeLibraryId;

      yield* database
        .insert(libraries)
        .values({
          id,
          workspaceId,
          displayName,
          sourceKind: source.kind,
          sourcePath: source.path,
          createdAt: now,
        })
        .run()
        .pipe(
          Effect.onError((cause) => reportFailure("libraries.add", cause)),
          Effect.mapError(storageError),
        );

      return new Library({ id, workspaceId, displayName, source, createdAt: now });
    });

    return { list, get, add } satisfies Libraries["Service"];
  }),
);
