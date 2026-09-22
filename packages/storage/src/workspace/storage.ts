import { rmSync } from "node:fs";
import { join } from "node:path";
import { workspaceDirectoryName, read, initialize } from "./metadata";
import { inspectDirectory, inspectRoot } from "../directory";

type Inspection = {
  readonly root: string;
  readonly path: string;
} & (
  | { readonly status: "ready" | "missing" | "removed" }
  | { readonly status: "blocked"; readonly message: string }
);

export function at(root: string) {
  const path = join(root, workspaceDirectoryName);
  const inspect = (): Inspection => {
    try {
      if (!inspectRoot(root) || !inspectDirectory(path)) return { root, path, status: "missing" };
      return { root, path, status: "ready" };
    } catch (error) {
      let message = String(error);
      if (error instanceof Error) message = error.message;
      return { root, path, status: "blocked", message };
    }
  };

  return {
    root,
    read: read(root),
    initialize: initialize(root),
    inspect,
    reset(): Inspection {
      const target = inspect();
      if (target.status !== "ready") return target;
      try {
        rmSync(path, { recursive: true, force: true });
        return { ...target, status: "removed" };
      } catch (error) {
        let message = String(error);
        if (error instanceof Error) message = error.message;
        return { ...target, status: "blocked", message };
      }
    },
  };
}

export { discover, workspaceDirectoryName as directoryName } from "./metadata";
