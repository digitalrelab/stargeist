import { useAtomMount } from "@effect/atom-react";
import type { LibraryId } from "@stargeist/domain";
import { Atom } from "effect/unstable/reactivity";
import { useEffect, useMemo } from "react";
import { createFileSelectionController, type FileInteraction } from "../selection";
import type { FileListing } from "../state";
import { useFileInspection } from "./file-inspection";
import { FileList } from "./file-list";

export function FileBrowser({
  listing,
  libraryId,
  folder,
}: {
  listing: FileListing;
  libraryId: LibraryId;
  folder: string | undefined;
}) {
  const inspection = useFileInspection();
  const selection = useMemo(() => {
    const onInteraction = Atom.writable(
      () => undefined,
      (ctx, interaction: FileInteraction) => {
        const extent = ctx.get(listing.extent);
        let total: number | undefined;

        if (!extent.hasMore) {
          total = extent.count;
        }

        ctx.set(inspection.command, {
          type: "interact",
          input: { interaction, libraryId, folder, total },
        });
      },
    );

    return createFileSelectionController(listing, onInteraction);
  }, [listing, inspection.command, libraryId, folder]);

  useAtomMount(selection.command);
  useEffect(() => inspection.cancelNavigation, [inspection, listing]);

  return (
    <FileList
      listing={listing}
      selection={selection}
      inspectedName={inspection.inspectedName(listing.id)}
      onFocus={inspection.onFocus}
    />
  );
}
