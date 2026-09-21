import type { FileSystemEntry } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection/react";
import { createContext, useContext, useId, useMemo, useState, type KeyboardEvent } from "react";
import { canRetryFailure } from "#src/client/index.ts";
import { createFileSelectionController, type FileInteraction } from "../../selection";
import type { FileListing } from "../../state";

export const rowHeight = 42;

export interface FileListProps {
  listing: FileListing;
  onInteraction: (interaction: FileInteraction, trigger: HTMLElement) => void;
}

export function useFileList({ listing, onInteraction }: FileListProps) {
  const selection = useMemo(() => createFileSelectionController(listing), [listing]);
  const gridId = useId();
  const [column, setColumn] = useState(1);
  const navigation = Selection.useController(selection, {
    onInteraction,
    pageSize: (element) => Math.floor((element?.clientHeight ?? rowHeight) / rowHeight),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target === event.currentTarget &&
      !event.defaultPrevented &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      if (event.key === "Enter" && event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "ArrowLeft") setColumn(0);
        else setColumn(1);
        return;
      }
      if (
        event.key === "Enter" &&
        navigation.request._tag === "Failure" &&
        canRetryFailure(navigation.request.cause)
      ) {
        event.preventDefault();
        event.stopPropagation();
        navigation.dispatch({ type: "retry" });
        return;
      }
      if (event.key === "Enter" && column === 0) {
        event.preventDefault();
        event.stopPropagation();
        navigation.dispatch({ type: "toggle" });
        return;
      }
    }
    navigation.props.onKeyDown(event);
  };

  return {
    listing,
    gridId,
    column,
    active: navigation.active,
    focused: navigation.focused,
    selection,
    rowProps: navigation.itemProps,
    viewportProps: { ...navigation.props, onKeyDown },
    inspect: (index: number, entry: FileSystemEntry) => {
      setColumn(1);
      navigation.activate({ index, item: entry });
    },
    toggle: (index: number, entry: FileSystemEntry) => {
      setColumn(0);
      navigation.toggle({ index, item: entry });
    },
    extend: (index: number, nextColumn: number) => {
      setColumn(nextColumn);
      navigation.extend(index);
    },
    clear: navigation.clear,
    cancel: navigation.cancel,
    retry: () => {
      navigation.dispatch({ type: "retry" });
      navigation.focus();
    },
  };
}

export const FileListContext = createContext<ReturnType<typeof useFileList> | undefined>(undefined);

export function useFileListContext() {
  const context = useContext(FileListContext);
  if (!context) throw new Error("File list parts must be rendered inside FileList.");
  return context;
}
