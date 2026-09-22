import { Schema } from "effect";
import { File } from "../files";

export const ListingId = Schema.String.pipe(Schema.brand("ListingId"));
export type ListingId = typeof ListingId.Type;

export const directoryPageSize = 256;
export const PageOffset = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER - directoryPageSize),
);

export const DirectoryListingPage = Schema.Struct({
  listingId: ListingId,
  offset: PageOffset,
  files: Schema.Array(File),
  hasMore: Schema.Boolean,
});
export type DirectoryListingPage = typeof DirectoryListingPage.Type;
