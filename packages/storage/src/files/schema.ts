import { FileType } from "@stargeist/domain";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const files = sqliteTable(
  "files",
  {
    id: text().primaryKey(),
    source: text().notNull(),
    objectKey: text("object_key").notNull(),
    evidence: text(),
    retired: integer({ mode: "boolean" }).notNull().default(false),
    name: text().notNull(),
    type: text({ enum: FileType.literals }).notNull(),
    mediaType: text("media_type"),
  },
  (table) => [
    uniqueIndex("files_current_source_object_key")
      .on(table.source, table.objectKey)
      .where(sql`${table.retired} = 0`),
  ],
);
