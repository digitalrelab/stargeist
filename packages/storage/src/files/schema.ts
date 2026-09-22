import type { FileId } from "@stargeist/domain";
import { primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const files = sqliteTable(
  "files",
  {
    id: text().primaryKey(),
    source: text().notNull(),
    key: text().notNull(),
  },
  (table) => [uniqueIndex("files_source_key").on(table.source, table.key)],
);

export const fileMetadata = sqliteTable(
  "file_metadata",
  {
    fileId: text("file_id")
      .$type<FileId>()
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    key: text().notNull(),
    value: text().notNull(),
  },
  (table) => [primaryKey({ columns: [table.fileId, table.key] })],
);
