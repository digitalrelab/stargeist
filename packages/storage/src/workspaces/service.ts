import { WorkspaceError, WorkspaceId } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { sep } from "node:path";
import { Effect, Schema } from "effect";
import { eq, sql } from "drizzle-orm";
import { AppDatabase } from "../app/database";
import { workspaces } from "./schema";

const Record = Schema.Struct({
  id: WorkspaceId,
  identity: Schema.NonEmptyString,
  root: Schema.NonEmptyString,
});
type WorkspaceRecord = typeof Record.Type;
const decode = Schema.decodeUnknownEffect(Schema.Array(Record));

const storageError = () =>
  new WorkspaceError({
    code: "StorageUnavailable",
    message: "Recent workspaces could not be read or saved. Try again.",
  });

function pathPrefix(root: string) {
  if (root.endsWith(sep)) return root;
  return `${root}${sep}`;
}

const storage = <A, E, R>(operation: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.onError((cause) => reportFailure(operation, cause)),
    Effect.mapError(storageError),
  );

export const makeWorkspaceStore = Effect.gen(function* () {
  const database = yield* AppDatabase;
  const records = (
    session: Pick<typeof database, "select" | "insert" | "delete" | "get" | "run">,
  ) => ({
    get: (id: WorkspaceId) =>
      storage(
        "workspaces.store.get",
        session
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, id))
          .all()
          .pipe(
            Effect.flatMap(decode),
            Effect.map((rows) => rows[0]),
          ),
      ),
    atRoot: (root: string) =>
      storage(
        "workspaces.store.find",
        session
          .select()
          .from(workspaces)
          .where(eq(workspaces.root, root))
          .all()
          .pipe(
            Effect.flatMap(decode),
            Effect.map((rows) => rows[0]),
          ),
      ),
    put: (record: WorkspaceRecord) =>
      storage(
        "workspaces.store.put",
        session
          .insert(workspaces)
          .values(record)
          .onConflictDoUpdate({
            target: workspaces.id,
            set: { root: record.root, identity: record.identity },
          })
          .run()
          .pipe(Effect.asVoid),
      ),
    remove: (id: WorkspaceId) =>
      storage(
        "workspaces.store.remove",
        session.delete(workspaces).where(eq(workspaces.id, id)).run().pipe(Effect.asVoid),
      ),
    relocate: (record: WorkspaceRecord, root: string) =>
      Effect.gen(function* () {
        const oldPrefix = pathPrefix(record.root);
        const newPrefix = pathPrefix(root);
        const oldLimit = `${oldPrefix.slice(0, -1)}${String.fromCharCode(sep.charCodeAt(0) + 1)}`;
        const conflict = yield* storage(
          "workspaces.store.relocate.check",
          session.get<{ found: number }>(sql`
            SELECT 1 AS found FROM files AS prior JOIN files AS target
              ON target.source = 'local'
              AND target.key = CASE
                WHEN prior.key = ${record.root} THEN ${root}
                ELSE ${newPrefix} || substr(prior.key, length(${oldPrefix}) + 1)
              END
            WHERE prior.source = 'local'
              AND (prior.key = ${record.root} OR (prior.key >= ${oldPrefix} AND prior.key < ${oldLimit}))
              AND target.id != prior.id
            LIMIT 1
          `),
        );
        if (conflict) {
          return yield* new WorkspaceError({
            code: "RootConflict",
            message: "Files at this location are already remembered.",
          });
        }
        yield* storage(
          "workspaces.store.relocate.files",
          session.run(sql`
            UPDATE files SET key = CASE
              WHEN key = ${record.root} THEN ${root}
              ELSE ${newPrefix} || substr(key, length(${oldPrefix}) + 1)
            END
            WHERE source = 'local'
              AND (key = ${record.root} OR (key >= ${oldPrefix} AND key < ${oldLimit}))
          `),
        );
        yield* storage(
          "workspaces.store.relocate.workspace",
          session
            .insert(workspaces)
            .values({ ...record, root })
            .onConflictDoUpdate({ target: workspaces.id, set: { root } })
            .run(),
        );
      }),
  });
  return {
    list: storage(
      "workspaces.store.list",
      database
        .select()
        .from(workspaces)
        .orderBy(workspaces.root)
        .all()
        .pipe(Effect.flatMap(decode)),
    ),
    get: records(database).get,
    modify: <A>(
      operation: (session: ReturnType<typeof records>) => Effect.Effect<A, WorkspaceError>,
    ) =>
      database
        .transaction((transaction) => operation(records(transaction)))
        .pipe(
          Effect.catch((error) => {
            if (error instanceof WorkspaceError) return Effect.fail(error);
            return storage("workspaces.store.transaction", Effect.fail(error));
          }),
        ),
  };
});

export type WorkspaceStore = Effect.Success<typeof makeWorkspaceStore>;
