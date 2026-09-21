import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { workspaces } from "../workspaces/schema";

export const libraries = sqliteTable(
  "libraries",
  {
    id: text().primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    displayName: text("display_name").notNull(),
    sourceKind: text("source_kind", { enum: ["local-fs"] }).notNull(),
    sourcePath: text("source_path").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("libraries_workspace_id").on(table.workspaceId),
    check("libraries_display_name", sql`length(${table.displayName}) > 0`),
    check("libraries_source_kind", sql`${table.sourceKind} = 'local-fs'`),
  ],
);
