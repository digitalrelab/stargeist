import { WorkspaceError, WorkspaceId } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect, Schema } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../database";
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

const storage = <A, E, R>(operation: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.onError((cause) => reportFailure(operation, cause)),
    Effect.mapError(storageError),
  );

export const makeWorkspaceStore = Effect.gen(function* () {
  const database = yield* Database;
  const records = (session: Pick<typeof database, "select" | "insert" | "delete">) => ({
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
