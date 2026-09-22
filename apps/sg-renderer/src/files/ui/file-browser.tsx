import { useAtomMount } from "@effect/atom-react";
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
  const inspection = useFileInspection();
  const selection = useMemo(
    () => createFileSelectionController(listing, inspection.bind(listing, { libraryId, folder })),
    [listing, inspection.bind, libraryId, folder],
  );

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
