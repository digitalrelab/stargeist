import { RegistryContext, useAtomMount } from "@effect/atom-react";
import type { LibraryId } from "@stargeist/domain";
import { useContext, useEffect, useMemo } from "react";
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
  const selection = useMemo(() => createFileSelectionController(listing), [listing]);
  const inspection = useFileInspection();
  const registry = useContext(RegistryContext);
  useAtomMount(selection.command);

  useEffect(() => inspection.cancelNavigation, [inspection, listing]);

  const onInteraction = (interaction: FileInteraction, trigger: HTMLElement) => {
    const extent = registry.get(listing.extent);
    let total: number | undefined;

    if (!extent.hasMore) {
      total = extent.count;
    }

    inspection.interact({ interaction, libraryId, folder, total }, trigger);
  };

  return (
    <FileList
      listing={listing}
      selection={selection}
      inspectedName={inspection.inspectedName(listing.id)}
      onInteraction={onInteraction}
    />
  );
}
