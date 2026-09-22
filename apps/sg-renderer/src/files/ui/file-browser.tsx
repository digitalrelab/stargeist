import { useAtomMount, useAtomValue } from "@effect/atom-react";
import type { LibraryId } from "@stargeist/domain";
import { useEffect, useMemo } from "react";
import { createFileSelectionController } from "../selection";
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
  const selection = useMemo(() => createFileSelectionController(listing), [listing]);
  const inspection = useFileInspection();
  const extent = useAtomValue(listing.extent);
  useAtomMount(selection.command);

  let total: number | undefined;

  if (!extent.hasMore) {
    total = extent.count;
  }

  useEffect(() => inspection.cancelNavigation, [inspection, listing]);

  return (
    <FileList
      listing={listing}
      selection={selection}
      onInteraction={(interaction, trigger) =>
        inspection.interact({ interaction, libraryId, folder, total }, trigger)
      }
    />
  );
}
