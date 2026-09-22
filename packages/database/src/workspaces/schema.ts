import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text().primaryKey(),
  identity: text().notNull(),
  root: text().notNull().unique(),
});
