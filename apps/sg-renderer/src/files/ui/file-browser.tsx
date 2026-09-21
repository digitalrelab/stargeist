import { useAtomValue } from "@effect/atom-react";
import type { LibraryId } from "@stargeist/domain";
import { useEffect } from "react";
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
  const extent = useAtomValue(listing.extent);
  let total: number | undefined;
  if (!extent.hasMore) total = extent.count;
  useEffect(() => inspection.cancelNavigation, [inspection, listing]);

  return (
    <FileList
      listing={listing}
      onInteraction={(interaction, trigger) =>
        inspection.interact({ interaction, libraryId, folder, total }, trigger)
      }
    />
  );
}
