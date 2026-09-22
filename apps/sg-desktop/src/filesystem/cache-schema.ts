import { FileType } from "@stargeist/domain";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cachedFiles = sqliteTable("cached_files", {
  position: integer().primaryKey(),
  fileId: text("file_id").notNull(),
  name: text().notNull(),
  type: text({ enum: FileType.literals }).notNull(),
  mediaType: text("media_type"),
});
