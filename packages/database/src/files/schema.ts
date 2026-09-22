import { FileType } from "@stargeist/domain";
import { sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const files = sqliteTable(
  "files",
  {
    id: text().primaryKey(),
    source: text().notNull(),
    objectKey: text("object_key").notNull(),
    name: text().notNull(),
    type: text({ enum: FileType.literals }).notNull(),
    mediaType: text("media_type"),
  },
  (table) => [unique().on(table.source, table.objectKey)],
);
