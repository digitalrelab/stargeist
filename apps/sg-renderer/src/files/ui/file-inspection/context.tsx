import { useAtomSet } from "@effect/atom-react";
import type { DirectorySessionId } from "@stargeist/domain";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createFileInspection } from "./state";

const FileInspectionContext = createContext<ReturnType<typeof useInspection> | undefined>(
  undefined,
);

function useInspection() {
  const [inspection] = useState(createFileInspection);
  const dispatch = useAtomSet(inspection.command);

  return useMemo(
    () => ({
      bind: inspection.bind,
      target: inspection.target,
      inspectedIndex: inspection.inspectedIndex,
      detail: inspection.detail,
      clear: (scope: DirectorySessionId) => dispatch({ type: "clear", scope }),
    }),
    [inspection, dispatch],
  );
}

export function FileInspectionProvider({ children }: { children: ReactNode }) {
  const inspection = useInspection();

  return <FileInspectionContext value={inspection}>{children}</FileInspectionContext>;
}

export function useFileInspection() {
  const context = useContext(FileInspectionContext);

  if (!context) {
    throw new Error("File inspection requires FileInspectionProvider.");
  }

  return context;
}
