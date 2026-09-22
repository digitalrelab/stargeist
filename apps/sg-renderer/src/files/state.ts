import { directoryPageSize, type DirectoryListingPage } from "@stargeist/domain";
import * as Pagination from "@stargeist/std/pagination";
import { Effect } from "effect";

export const createFileListing = (
  initial: DirectoryListingPage,
  readPage: (offset: number) => Effect.Effect<DirectoryListingPage, unknown>,
) => {
  const { extent, pages, read, pageOffset } = Pagination.makeIndexed({
    pageSize: directoryPageSize,
    source: {
      initial: toPage(initial),
      cursorAt: (offset) => offset,
      read: (offset) => readPage(offset).pipe(Effect.map(toPage)),
    },
  });

  return { id: initial.listingId, extent, pages, read, pageOffset };
};

function toPage(page: DirectoryListingPage) {
  let next: number | null = null;

  if (page.hasMore) {
    next = page.offset + page.files.length;
  }

  return { items: page.files, next };
}

export type FileListing = ReturnType<typeof createFileListing>;
