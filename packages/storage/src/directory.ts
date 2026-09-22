import { lstatSync, realpathSync } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { StorageError } from "./errors";

export function inspectDirectory(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return false;
  if (!stat.isDirectory()) {
    throw new StorageError("unsafe-path", `Expected an ordinary directory: ${path}`);
  }
  return true;
}

export function inspectRoot(path: string) {
  if (!isAbsolute(path) || resolve(path) !== path) {
    throw new StorageError("unsafe-path", `Expected an absolute directory: ${path}`);
  }
  if (!inspectDirectory(path)) return false;
  if (realpathSync(path) !== path) {
    throw new StorageError("unsafe-path", `The directory path has been redirected: ${path}`);
  }
  return true;
}

export async function syncDirectory(path: string) {
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
