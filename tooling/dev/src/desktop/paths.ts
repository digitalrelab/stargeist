import { AppStorage } from "@stargeist/storage";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { ProfileError } from "./errors";
import { identifyDirectory } from "../identity";

export function applicationDataDirectory() {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  if (process.platform === "win32") {
    const path = process.env.APPDATA;

    if (path && isAbsolute(path)) {
      return path;
    }

    throw new ProfileError(
      "invalid-environment",
      "APPDATA must identify an absolute application-data directory.",
    );
  }

  if (process.platform === "linux") {
    const path = process.env.XDG_CONFIG_HOME;

    if (!path) {
      return join(homedir(), ".config");
    }

    if (isAbsolute(path)) {
      return path;
    }

    throw new ProfileError("invalid-environment", "XDG_CONFIG_HOME must be an absolute path.");
  }

  throw new ProfileError(
    "invalid-environment",
    `Unsupported desktop platform: ${process.platform}.`,
  );
}

function canonicalPath(path: string): string {
  try {
    return realpathSync(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }

    const parent = dirname(path);

    if (parent === path) {
      throw error;
    }

    return join(canonicalPath(parent), basename(path));
  }
}

export function developmentProfile(applicationPath: string, appData = applicationDataDirectory()) {
  const { directory: application, identity } = identifyDirectory(applicationPath);

  const base = join(canonicalPath(resolve(appData)), "Stargeist-development");
  const root = join(base, identity);
  const controls = join(base, ".control");
  const control = join(controls, identity);
  const storage = AppStorage.at(root);

  return {
    root,
    data: storage.directory,
    application,
    identity,
    base,
    controls,
    control,
    lock: join(control, "profile.lock"),
    marker: join(root, ".development-owner.json"),
    quarantine: storage.quarantine,
  };
}

export type DevelopmentProfile = ReturnType<typeof developmentProfile>;
