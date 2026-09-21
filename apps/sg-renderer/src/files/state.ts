import { entryPageSize, type DirectoryListingPage } from "@stargeist/domain";
import * as Pagination from "@stargeist/std/pagination";
import { Effect } from "effect";

export const createFileListing = (
  initial: DirectoryListingPage,
  readPage: (offset: number) => Effect.Effect<DirectoryListingPage, unknown>,
) =>
  Pagination.makeIndexed({
    pageSize: entryPageSize,
    source: {
      initial: toPage(initial),
      cursorAt: (offset) => offset,
      read: (offset) => readPage(offset).pipe(Effect.map(toPage)),
    },
  });

function toPage(page: DirectoryListingPage) {
  let next: number | null = null;
  if (page.hasMore) next = page.offset + page.entries.length;
  return { items: page.entries, next };
}

export type FileListing = ReturnType<typeof createFileListing>;
