import {
  Workspace,
  WorkspaceError,
  type WorkspaceId,
  makeWorkspaceId,
} from "@stargeist/domain/workspaces";
import { WorkspaceRepository, type SelectedFolder } from "@stargeist/domain/workspaces/repository";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

const storageError = () =>
  new WorkspaceError({
    code: "StorageUnavailable",
    message: "Workspace records could not be read or saved. Try again.",
  });

const decode = Schema.decodeUnknownEffect(Schema.Array(Workspace));

export const repositoryLayer = Layer.effect(
  WorkspaceRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const list = sql`
      SELECT id, name, root_path AS rootPath, created_at AS createdAt, opened_at AS openedAt
      FROM workspaces
      ORDER BY opened_at DESC, id
    `.pipe(
      Effect.flatMap(decode),
      Effect.onError((cause) => reportFailure("workspaces.list", cause)),
      Effect.mapError(storageError),
    );

    const get = (id: WorkspaceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT id, name, root_path AS rootPath, created_at AS createdAt, opened_at AS openedAt
          FROM workspaces
          WHERE id = ${id}
        `.pipe(
          Effect.flatMap(decode),
          Effect.onError((cause) => reportFailure("workspaces.get", cause)),
          Effect.mapError(storageError),
        );

        const workspace = rows[0];

        if (!workspace) {
          return yield* Effect.fail(
            new WorkspaceError({
              code: "NotFound",
              message: "This workspace is no longer available.",
            }),
          );
        }

        return workspace;
      });

    const register = (folder: SelectedFolder, now: number) =>
      Effect.gen(function* () {
        const id = yield* makeWorkspaceId;
        const rows = yield* sql`
          INSERT INTO workspaces (id, identity, name, root_path, created_at, opened_at)
          VALUES (${id}, ${folder.identity}, ${folder.name}, ${folder.rootPath}, ${now}, ${now})
          ON CONFLICT(identity) DO UPDATE SET
            root_path = excluded.root_path,
            name = excluded.name,
            opened_at = excluded.opened_at
          RETURNING id, name, root_path AS rootPath, created_at AS createdAt, opened_at AS openedAt
        `;

        const [workspace] = yield* decode(rows);

        if (!workspace) return yield* Effect.fail(storageError());

        return workspace;
      }).pipe(
        Effect.onError((cause) => reportFailure("workspaces.register", cause)),
        Effect.mapError(storageError),
      );

    return { list, get, register } satisfies WorkspaceRepository["Service"];
  }),
);
