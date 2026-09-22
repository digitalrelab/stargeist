import { useAtomSet } from "@effect/atom-react";
import type { FileSnapshot } from "@stargeist/domain";
import type { Command } from "@stargeist/std/selection";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { createFileSelectionController } from "../../selection";
import type { DirectoryContents } from "../../state";
import { useFileInspection } from "../file-inspection";

export interface FileBrowserProps {
  contents: DirectoryContents;
  folder: string | undefined;
}

export function useFileBrowser({ contents, folder }: FileBrowserProps) {
  const inspection = useFileInspection();
  const view = useRef<HTMLDivElement>(null);
  const selection = useMemo(
    () => createFileSelectionController(contents, inspection.bind(contents, folder)),
    [contents, inspection.bind, folder],
  );
  const send = useAtomSet(selection.command);

  useEffect(
    () => () => inspection.clear(contents.sessionId),
    [inspection, contents.sessionId, selection],
  );

  return useMemo(
    () => ({
      contents,
      selection,
      inspectedIndex: inspection.inspectedIndex(contents.sessionId),
      viewProps: { ref: view },
      dispatch: (command: Command<FileSnapshot, number>) => {
        send(command);
        view.current?.focus({ preventScroll: true });
      },
    }),
    [contents, selection, inspection, send],
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
