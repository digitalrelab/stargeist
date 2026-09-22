import type { FileSystemEntry } from "@stargeist/domain";
import { Selection } from "@stargeist/std/selection/react";
import type { Atom } from "effect/unstable/reactivity";
import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type FocusEventHandler,
} from "react";
import { canRetryFailure } from "#src/client/index.ts";
import type { FileSelectionController } from "../../selection";
import type { FileListing } from "../../state";
import { rowHeight } from "./layout";

export interface FileListProps {
  listing: FileListing;
  selection: FileSelectionController;
  inspectedName: Atom.Atom<string | undefined>;
  onFocus: FocusEventHandler<HTMLDivElement>;
}

export function useFileList({ listing, selection, inspectedName, onFocus }: FileListProps) {
  const gridId = useId();
  const [column, setColumn] = useState(1);
  const navigation = Selection.useController(selection, {
    pageSize: (element) => Math.floor((element?.clientHeight ?? rowHeight) / rowHeight),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      navigation.props.onKeyDown(event);
      return;
    }

    switch (event.key) {
      case "ArrowLeft":
        setColumn(0);
        break;

      case "ArrowRight":
        setColumn(1);
        break;

      case "Enter":
        if (event.repeat) {
          break;
        }

        if (navigation.request._tag === "Failure" && canRetryFailure(navigation.request.cause)) {
          navigation.dispatch({ type: "retry" });
        } else if (column === 0) {
          navigation.dispatch({ type: "toggle" });
        } else {
          navigation.props.onKeyDown(event);
          return;
        }
        break;

      default:
        navigation.props.onKeyDown(event);
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return {
    listing,
    gridId,
    column,
    active: navigation.active,
    selection,
    inspectedName,
    rowProps: navigation.itemProps,
    viewportProps: { ...navigation.props, onKeyDown, onFocus },
    inspect: (index: number, entry: FileSystemEntry) => {
      setColumn(1);
      navigation.dispatch({ type: "activate", value: { index, item: entry } });
    },
    toggle: (index: number, entry: FileSystemEntry) => {
      setColumn(0);
      navigation.dispatch({ type: "toggle", value: { index, item: entry } });
    },
    extend: (index: number, nextColumn: number) => {
      setColumn(nextColumn);
      navigation.dispatch({ type: "range", index });
    },
    clear: () => navigation.dispatch({ type: "clear" }),
    cancel: () => navigation.dispatch({ type: "cancel" }),
    retry: () => navigation.dispatch({ type: "retry" }),
  };
}

export const FileListContext = createContext<ReturnType<typeof useFileList> | undefined>(undefined);

export function useFileListContext() {
  const context = useContext(FileListContext);

  if (!context) {
    throw new Error("File list parts must be rendered inside FileList.");
  }

  return context;
}
