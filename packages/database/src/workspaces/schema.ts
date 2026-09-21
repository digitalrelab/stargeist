import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text().primaryKey(),
    displayName: text("display_name").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [check("workspaces_display_name", sql`length(${table.displayName}) > 0`)],
);
