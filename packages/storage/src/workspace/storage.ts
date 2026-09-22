import { lstatSync, realpathSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { workspaceDirectoryName, read, initialize } from "./metadata";

type Inspection = {
  readonly root: string;
  readonly path: string;
} & (
  | { readonly status: "ready" | "missing" | "removed" }
  | { readonly status: "blocked"; readonly message: string }
);

function ordinaryDirectory(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat && !stat.isDirectory()) throw new Error(`Expected an ordinary directory: ${path}`);
  return stat;
}

export function at(root: string) {
  const path = join(root, workspaceDirectoryName);
  const inspect = (): Inspection => {
    try {
      if (!isAbsolute(root) || resolve(root) !== root) {
        throw new Error(`Expected an absolute workspace path: ${root}`);
      }
      if (!ordinaryDirectory(root)) return { root, path, status: "missing" };
      if (realpathSync(root) !== root) {
        throw new Error(`The workspace path has been redirected: ${root}`);
      }
      if (!ordinaryDirectory(path)) return { root, path, status: "missing" };
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
