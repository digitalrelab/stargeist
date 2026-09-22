import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";
import { Schema } from "effect";
import { workspaces } from "./schema";

const decodeRoots = Schema.decodeUnknownSync(
  Schema.Array(Schema.Struct({ root: Schema.NonEmptyString })),
);

export function readWorkspaceRoots(filename: string): ReadonlyArray<string> {
  using connection = new DatabaseSync(filename, { readOnly: true });
  const database = drizzle({ client: connection });
  const rows = database
    .select({ root: workspaces.root })
    .from(workspaces)
    .orderBy(workspaces.root)
    .all();
  return decodeRoots(rows).map(({ root }) => root);
}
