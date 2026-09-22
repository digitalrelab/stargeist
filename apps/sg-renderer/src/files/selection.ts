import type { FileSnapshot, DirectorySessionId } from "@stargeist/domain";
import { Selection, type Interaction, type SelectionState } from "@stargeist/std/selection";
import { Effect } from "effect";
import type { Atom } from "effect/unstable/reactivity";
import type { DirectoryContents } from "./state";

export const createFileSelectionController = (
  contents: DirectoryContents,
  onInteraction?: Atom.Writable<unknown, FileInteraction>,
) => {
  return Selection.create(
    {
      scope: contents.sessionId,
      extent: contents.extent,
      keyOf: ({ index }) => index,
      read: Effect.fnUntraced(function* (index: number, options: { readonly retry: boolean }) {
        const offset = contents.pageOffset(index);
        const page = yield* contents.read(offset, options);

        return page.items[index - offset];
      }),
      readRange: (from: number, to: number) =>
        Effect.sync(() => Array.from({ length: to - from + 1 }, (_, index) => from + index)),
    },
    onInteraction,
  );
};

export type FileSelectionController = ReturnType<typeof createFileSelectionController>;

export interface FileSelection {
  readonly folder: string | undefined;
  readonly members: SelectionState<number, DirectorySessionId>;
}

export type FileInteraction = Interaction<FileSnapshot, number, DirectorySessionId>;
