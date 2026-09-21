import { Library, type LibrarySource, makeLibraryId } from "@stargeist/domain/libraries";
import {
  Workspace,
  WorkspaceError,
  type WorkspaceId,
  makeWorkspaceId,
} from "@stargeist/domain/workspaces";
import { WorkspaceRepository } from "@stargeist/domain/workspaces/repository";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Layer, Schema } from "effect";
import { desc, eq } from "drizzle-orm";
import { Database } from "../sqlite";
import { libraries } from "../libraries/schema";
import { workspaces } from "./schema";

const storageError = () =>
  new WorkspaceError({
    code: "StorageUnavailable",
    message: "Workspace records could not be read or saved. Try again.",
  });

const decodeWorkspaces = Schema.decodeUnknownEffect(Schema.Array(Workspace));

const notFound = () =>
  new WorkspaceError({ code: "NotFound", message: "This workspace is no longer available." });

export const repositoryLayer = Layer.effect(
  WorkspaceRepository,
  Effect.gen(function* () {
    const database = yield* Database;

    const list = database
      .select()
      .from(workspaces)
      .orderBy(desc(workspaces.createdAt), workspaces.id)
      .all()
      .pipe(
        Effect.flatMap(decodeWorkspaces),
        Effect.onError((cause) => reportFailure("workspaces.list", cause)),
        Effect.mapError(storageError),
      );

    const get = Effect.fnUntraced(function* (id: WorkspaceId) {
      const rows = yield* database
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, id))
        .all()
        .pipe(
          Effect.flatMap(decodeWorkspaces),
          Effect.onError((cause) => reportFailure("workspaces.get", cause)),
          Effect.mapError(storageError),
        );

      const workspace = rows[0];

      if (!workspace) {
        return yield* Effect.fail(notFound());
      }

      return workspace;
    });

    const create = Effect.fnUntraced(
      function* (displayName: string, source: typeof LibrarySource.Type, now: number) {
        const workspaceId = yield* makeWorkspaceId;
        const libraryId = yield* makeLibraryId;
        const workspace = new Workspace({ id: workspaceId, displayName, createdAt: now });
        const library = new Library({
          id: libraryId,
          workspaceId,
          displayName,
          source,
          createdAt: now,
        });

        yield* database.transaction((transaction) =>
          Effect.gen(function* () {
            yield* transaction.insert(workspaces).values(workspace).run();

            yield* transaction
              .insert(libraries)
              .values({
                id: library.id,
                workspaceId,
                displayName,
                sourceKind: source.kind,
                sourcePath: source.path,
                createdAt: now,
              })
              .run();
          }),
        );

        return { workspace, library };
      },
      Effect.onError((cause) => reportFailure("workspaces.create", cause)),
      Effect.mapError(storageError),
    );

    return { list, get, create } satisfies WorkspaceRepository["Service"];
  }),
);
