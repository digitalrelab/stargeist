import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

export const workspaceMigration = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE workspaces (
      id TEXT PRIMARY KEY,
      identity TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      root_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      opened_at INTEGER NOT NULL
    )
  `;
});
