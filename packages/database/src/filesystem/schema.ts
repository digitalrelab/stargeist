import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  position: integer().primaryKey(),
  name: text().notNull(),
  kind: text({ enum: ["file", "directory", "symlink", "other"] }).notNull(),
});
