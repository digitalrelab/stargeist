import { useAtomValue } from "@effect/atom-react";
import type { File } from "@stargeist/domain";
import {
  createContext,
  useContext,
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { canRetryFailure } from "#src/client/index.ts";
import { useFileBrowserContext } from "../file-browser";
import { rowHeight } from "./layout";

export function useFileList() {
  const { selection, dispatch, viewProps } = useFileBrowserContext();
  const active = useAtomValue(selection.active);
  const request = useAtomValue(selection.request);
  const gridId = useId();
  const [column, setColumn] = useState(1);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.defaultPrevented ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() !== "a" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!event.repeat) {
        dispatch({ type: "all" });
      }

      return;
    }

    switch (event.key) {
      case "ArrowDown":
        dispatch({ type: "move", by: 1, extend: event.shiftKey });
        break;

      case "ArrowUp":
        dispatch({ type: "move", by: -1, extend: event.shiftKey });
        break;

      case "ArrowLeft":
      case "ArrowRight":
        if (event.shiftKey) {
          return;
        }

        if (event.key === "ArrowLeft") {
          setColumn(0);
        } else {
          setColumn(1);
        }
        break;

      case "Home":
        dispatch({ type: "first", extend: event.shiftKey });
        break;

      case "End":
        dispatch({ type: "last", extend: event.shiftKey });
        break;

      case "PageDown":
      case "PageUp": {
        let by = Math.max(1, Math.floor(event.currentTarget.clientHeight / rowHeight));

        if (event.key === "PageUp") {
          by = -by;
        }

        dispatch({ type: "move", by, extend: event.shiftKey });
        break;
      }

      case " ":
        if (!event.repeat) {
          if (event.shiftKey) {
            dispatch({ type: "range", index: active ?? 0 });
          } else {
            dispatch({ type: "toggle" });
          }
        }
        break;

      case "Enter":
        if (event.shiftKey) {
          return;
        }

        if (!event.repeat) {
          if (request._tag === "Failure" && canRetryFailure(request.cause)) {
            dispatch({ type: "retry" });
          } else if (column === 0) {
            dispatch({ type: "toggle" });
          } else {
            dispatch({ type: "activate" });
          }
        }
        break;

      case "Escape":
        if (event.shiftKey) {
          return;
        }

        if (request.waiting || request._tag === "Failure") {
          dispatch({ type: "cancel" });
        } else {
          dispatch({ type: "clear" });
        }
        break;

      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return {
    gridId,
    column,
    active,
    rowProps: {
      onMouseDown: (event: MouseEvent<HTMLElement>) => {
        if (event.button === 0) {
          event.preventDefault();
        }
      },
    },
    viewportProps: { ...viewProps, tabIndex: 0, onKeyDown },
    inspect: (index: number, file: File) => {
      setColumn(1);
      dispatch({ type: "activate", value: { index, item: file } });
    },
    toggle: (index: number, file: File) => {
      setColumn(0);
      dispatch({ type: "toggle", value: { index, item: file } });
    },
    extend: (index: number, nextColumn: number) => {
      setColumn(nextColumn);
      dispatch({ type: "range", index });
    },
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
