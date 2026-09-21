import {
  Library,
  type LibrarySource,
  LibraryError,
  makeLibraryId,
} from "@stargeist/domain/libraries";
import { LibraryRepository, type LibrarySelection } from "@stargeist/domain/libraries/repository";
import type { WorkspaceId } from "@stargeist/domain/workspaces";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Layer, Schema } from "effect";
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

const libraryRow = Schema.Struct({
  id: Library.fields.id,
  workspaceId: Library.fields.workspaceId,
  displayName: Library.fields.displayName,
  sourceKind: Schema.Literal("local-fs"),
  sourcePath: Schema.String,
  createdAt: Schema.Number,
});

const decodeLibraries = (rows: unknown) =>
  Schema.decodeUnknownEffect(Schema.Array(libraryRow))(rows).pipe(
    Effect.map((rows) =>
      rows.map(
        (row) =>
          new Library({
            id: row.id,
            workspaceId: row.workspaceId,
            displayName: row.displayName,
            source: { kind: row.sourceKind, path: row.sourcePath },
            createdAt: row.createdAt,
          }),
      ),
    ),
  );

export const repositoryLayer = Layer.effect(
  LibraryRepository,
  Effect.gen(function* () {
    const database = yield* Database;

    const requireWorkspace = (id: WorkspaceId) =>
      Effect.gen(function* () {
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

    const list = (workspaceId: WorkspaceId) =>
      Effect.gen(function* () {
        yield* requireWorkspace(workspaceId);

        return yield* database
          .select()
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

    const get = ({ workspaceId, id }: LibrarySelection) =>
      Effect.gen(function* () {
        const rows = yield* database
          .select()
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

    const add = (
      workspaceId: WorkspaceId,
      source: typeof LibrarySource.Type,
      displayName: string,
      now: number,
    ) =>
      Effect.gen(function* () {
        yield* requireWorkspace(workspaceId);

        return yield* Effect.gen(function* () {
          const id = yield* makeLibraryId;

          const rows = yield* database
            .insert(libraries)
            .values({
              id,
              workspaceId,
              displayName,
              sourceKind: source.kind,
              sourcePath: source.path,
              createdAt: now,
            })
            .returning()
            .all();

          const [library] = yield* decodeLibraries(rows);

          if (!library) {
            return yield* Effect.fail(storageError());
          }

          return library;
        }).pipe(
          Effect.onError((cause) => reportFailure("libraries.add", cause)),
          Effect.mapError(storageError),
        );
      });

    return { list, get, add } satisfies LibraryRepository["Service"];
  }),
);
