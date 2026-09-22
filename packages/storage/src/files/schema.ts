import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const files = sqliteTable(
  "files",
  {
    id: text().primaryKey(),
    source: text().notNull(),
    key: text().notNull(),
  },
  (table) => [uniqueIndex("files_source_key").on(table.source, table.key)],
);
