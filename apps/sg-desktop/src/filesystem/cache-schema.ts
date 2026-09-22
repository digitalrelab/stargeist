import { FileKind } from "@stargeist/domain";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cachedFiles = sqliteTable("cached_files", {
  position: integer().primaryKey(),
  fileId: text("file_id").notNull(),
  name: text().notNull(),
  kind: text({ enum: FileKind.literals }).notNull(),
});
