import type { FileSystemEntry, LibraryId, ListingId } from "@stargeist/domain";
import { Selection, type Interaction, type SelectionState } from "@stargeist/std/selection";
import { Effect } from "effect";
import { AtomRegistry } from "effect/unstable/reactivity";
import type { FileListing } from "./state";

export const createFileSelectionController = (listing: FileListing) => {
  const readPage = Effect.fnUntraced(function* (offset: number, refresh: boolean) {
    const registry = yield* AtomRegistry.AtomRegistry;
    const page = listing.pages(offset);
    yield* AtomRegistry.mount(registry, page);
    if (refresh) registry.refresh(page);
    return yield* AtomRegistry.getResult(registry, page, { suspendOnWaiting: true });
  });

  return Selection.create({
    scope: listing.id,
    extent: listing.extent,
    keyOf: (entry: FileSystemEntry) => entry.name,
    read: Effect.fnUntraced(function* (index: number, options: { readonly refresh: boolean }) {
      const offset = listing.pageOffset(index);
      const page = yield* readPage(offset, options.refresh);
      return page.items[index - offset];
    }),
    readRange: Effect.fnUntraced(function* (
      from: number,
      to: number,
      options: { readonly refresh: boolean },
    ) {
      const keys: string[] = [];
      let index = from;
      while (index <= to) {
        const offset = listing.pageOffset(index);
        const page = yield* readPage(offset, options.refresh).pipe(Effect.scoped);
        const end = Math.min(to + 1, offset + page.items.length);
        if (index >= end) break;
        for (; index < end; index++) keys.push(page.items[index - offset]!.name);
      }
      return keys;
    }),
  });
};

export type FileSelectionController = ReturnType<typeof createFileSelectionController>;

export interface FileSelection {
  readonly libraryId: LibraryId;
  readonly folder: string | undefined;
  readonly members: SelectionState<string, ListingId>;
}

export type FileInteraction = Interaction<FileSystemEntry, string, ListingId>;
