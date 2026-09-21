import * as SqliteMigrator from "@effect/sql-sqlite-node/SqliteMigrator";
import { workspaceMigration } from "./001_workspaces";

export const migrations = SqliteMigrator.fromRecord({
  "001_workspaces": workspaceMigration,
});
