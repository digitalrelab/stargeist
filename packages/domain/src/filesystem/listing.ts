import { Schema } from "effect";
import { FileSystemEntry } from "./entry";

export const ListingId = Schema.String.pipe(Schema.brand("ListingId"));
export type ListingId = typeof ListingId.Type;

export const entryPageSize = 256;
export const PageOffset = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0),
  Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER - entryPageSize),
);

export const DirectoryListingPage = Schema.Struct({
  listingId: ListingId,
  offset: PageOffset,
  entries: Schema.Array(FileSystemEntry),
  hasMore: Schema.Boolean,
});
export type DirectoryListingPage = typeof DirectoryListingPage.Type;
