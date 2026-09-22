import { FileType } from "@stargeist/domain";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  position: integer().primaryKey(),
  id: text().notNull(),
  name: text().notNull(),
  type: text({ enum: FileType.literals }).notNull(),
  mediaType: text("media_type"),
});
