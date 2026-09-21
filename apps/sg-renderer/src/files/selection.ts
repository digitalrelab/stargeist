import type { FileSystemEntry, LibraryId, ListingId } from "@stargeist/domain";
import { Selection, type Interaction, type SelectionState } from "@stargeist/std/selection";
import { Effect } from "effect";
import type { FileListing } from "./state";

export const createFileSelectionController = (listing: FileListing) => {
  return Selection.create({
    scope: listing.id,
    extent: listing.extent,
    keyOf: (entry: FileSystemEntry) => entry.name,
    read: Effect.fnUntraced(function* (index: number, options: { readonly retry: boolean }) {
      const offset = listing.pageOffset(index);
      const page = yield* listing.read(offset, options);

      return page.items[index - offset];
    }),
    readRange: Effect.fnUntraced(function* (
      from: number,
      to: number,
      options: { readonly retry: boolean },
    ) {
      const keys: string[] = [];
      let index = from;

      while (index <= to) {
        const offset = listing.pageOffset(index);
        const page = yield* listing.read(offset, options).pipe(Effect.scoped);
        const end = Math.min(to + 1, offset + page.items.length);

        if (index >= end) {
          break;
        }

        for (; index < end; index++) {
          keys.push(page.items[index - offset]!.name);
        }
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
