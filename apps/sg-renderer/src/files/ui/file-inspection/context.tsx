import { useAtomSet } from "@effect/atom-react";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createFileInspection, type FileInspectionInput } from "./state";

const FileInspectionContext = createContext<ReturnType<typeof useInspection> | undefined>(
  undefined,
);

function useInspection(fallbackFocus: RefObject<HTMLElement | null>) {
  const [inspection] = useState(createFileInspection);
  const dispatch = useAtomSet(inspection.command);
  const origin = useRef<HTMLElement>(null);

  return useMemo(
    () => ({
      target: inspection.target,
      isOpen: inspection.isOpen,
      inspectedName: inspection.inspectedName,
      interact: (input: FileInspectionInput, trigger: HTMLElement) => {
        origin.current = trigger;
        dispatch({ type: "interact", input });
      },
      cancelNavigation: () => dispatch({ type: "cancel" }),
      close: () => {
        const trigger = origin.current;
        origin.current = null;
        dispatch({ type: "close" });

        if (trigger?.isConnected) {
          trigger.focus({ preventScroll: true });
        } else {
          fallbackFocus.current?.focus({ preventScroll: true });
        }
      },
    }),
    [inspection, dispatch, fallbackFocus],
  );
}

export function FileInspectionProvider({
  children,
  fallbackFocus,
}: {
  children: ReactNode;
  fallbackFocus: RefObject<HTMLElement | null>;
}) {
  const inspection = useInspection(fallbackFocus);

  return <FileInspectionContext value={inspection}>{children}</FileInspectionContext>;
}

export function useFileInspection() {
  const context = useContext(FileInspectionContext);

  if (!context) {
    throw new Error("File inspection requires FileInspectionProvider.");
  }

  return context;
}
