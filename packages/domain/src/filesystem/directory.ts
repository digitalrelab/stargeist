import { Schema } from "effect";
import { FileSnapshot } from "../files";

export const DirectorySessionId = Schema.String.pipe(Schema.brand("DirectorySessionId"));
export type DirectorySessionId = typeof DirectorySessionId.Type;

export const directoryPageSize = 256;
export const PageOffset = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER - directoryPageSize),
);

export const DirectoryPage = Schema.Struct({
  directorySessionId: DirectorySessionId,
  offset: PageOffset,
  files: Schema.Array(FileSnapshot),
  hasMore: Schema.Boolean,
});
export type DirectoryPage = typeof DirectoryPage.Type;
