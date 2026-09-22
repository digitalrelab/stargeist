import { useAtomSet } from "@effect/atom-react";
import type { FileSnapshot } from "@stargeist/domain";
import type { Command } from "@stargeist/std/selection";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { createFileSelectionController } from "../../selection";
import type { FileListing } from "../../state";
import { useFileInspection } from "../file-inspection";

export interface FileBrowserProps {
  listing: FileListing;
  folder: string | undefined;
}

export function useFileBrowser({ listing, folder }: FileBrowserProps) {
  const inspection = useFileInspection();
  const view = useRef<HTMLDivElement>(null);
  const selection = useMemo(
    () => createFileSelectionController(listing, inspection.bind(listing, folder)),
    [listing, inspection.bind, folder],
  );
  const send = useAtomSet(selection.command);

  useEffect(() => () => inspection.clear(listing.id), [inspection, listing.id, selection]);

  return useMemo(
    () => ({
      listing,
      selection,
      inspectedIndex: inspection.inspectedIndex(listing.id),
      viewProps: { ref: view },
      dispatch: (command: Command<FileSnapshot, number>) => {
        send(command);
        view.current?.focus({ preventScroll: true });
      },
    }),
    [listing, selection, inspection, send],
  );
}

export const FileBrowserContext = createContext<ReturnType<typeof useFileBrowser> | undefined>(
  undefined,
);

export function useFileBrowserContext() {
  const context = useContext(FileBrowserContext);

  if (!context) {
    throw new Error("File browser parts must be rendered inside FileBrowser.Root.");
  }

  return context;
}
