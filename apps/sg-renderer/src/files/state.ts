import { directoryPageSize, type DirectoryPage } from "@stargeist/domain";
import * as Pagination from "@stargeist/std/pagination";
import { Effect } from "effect";

export const createDirectoryContents = (
  initial: DirectoryPage,
  readPage: (offset: number) => Effect.Effect<DirectoryPage, unknown>,
) => {
  const { extent, pages, read, pageOffset } = Pagination.makeIndexed({
    pageSize: directoryPageSize,
    source: {
      initial: toPage(initial),
      cursorAt: (offset) => offset,
      read: (offset) => readPage(offset).pipe(Effect.map(toPage)),
    },
  });

  return { sessionId: initial.directorySessionId, extent, pages, read, pageOffset };
};

function toPage(page: DirectoryPage) {
  let next: number | null = null;

  if (page.hasMore) {
    next = page.offset + page.files.length;
  }

  return { items: page.files, next };
}

export type DirectoryContents = ReturnType<typeof createDirectoryContents>;
