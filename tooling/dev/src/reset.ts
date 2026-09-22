import { existsSync, lstatSync, realpathSync, renameSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { databaseFilename } from "@stargeist/database";
import { readWorkspaceRoots } from "@stargeist/database/workspaces";
import {
  inspectProfile,
  validateProfilePaths,
  type DevelopmentProfile,
  acquireProfileMaintenance,
  inspectProfileAccess,
  requireOwnedProfile,
  ProfileError,
  validateDirectory,
} from "./desktop/index";

type WorkspaceTarget = {
  readonly root: string;
  readonly path: string;
} & (
  | { readonly status: "ready" | "missing" | "removed" }
  | { readonly status: "blocked"; readonly message: string }
);

function workspaceRoots(profile: DevelopmentProfile) {
  const filename = join(profile.data, databaseFilename);
  const file = lstatSync(filename, { throwIfNoEntry: false });
  if (!file) {
    return [];
  }
  if (!file.isFile()) {
    throw new ProfileError("unsafe-path", `Expected an ordinary file: ${filename}`);
  }

  try {
    return readWorkspaceRoots(filename);
  } catch (cause) {
    throw new ProfileError(
      "workspace-registry-unavailable",
      `Known workspaces could not be read. App data was kept.\n${filename}`,
      { cause },
    );
  }
}

function inspectWorkspace(root: string): WorkspaceTarget {
  const path = join(root, ".stargeist");
  try {
    if (!isAbsolute(root) || resolve(root) !== root) {
      throw new ProfileError("unsafe-path", `Expected an absolute workspace path: ${root}`);
    }
    if (!validateDirectory(root)) {
      return { root, path, status: "missing" };
    }
    if (realpathSync(root) !== root) {
      throw new ProfileError("unsafe-path", `The workspace path has been redirected: ${root}`);
    }
    if (!validateDirectory(path)) {
      return { root, path, status: "missing" };
    }
    return { root, path, status: "ready" };
  } catch (error) {
    let message = String(error);
    if (error instanceof Error) {
      message = error.message;
    }
    return { root, path, status: "blocked", message };
  }
}

function resetWorkspace(root: string): WorkspaceTarget {
  const target = inspectWorkspace(root);
  if (target.status !== "ready") {
    return target;
  }
  try {
    rmSync(target.path, { recursive: true, force: true });
    return { ...target, status: "removed" };
  } catch (error) {
    let message = String(error);
    if (error instanceof Error) {
      message = error.message;
    }
    return { ...target, status: "blocked", message };
  }
}

export function previewReset(profile: DevelopmentProfile) {
  const ownership = inspectProfile(profile);

  if (ownership === "unmanaged") {
    requireOwnedProfile(profile);
  }

  const access = inspectProfileAccess(profile);

  return {
    command: "reset" as const,
    status: "preview" as const,
    scope: "development" as const,
    profile: profile.root,
    target: profile.data,
    exists: existsSync(profile.data),
    access,
    cleanupPending: existsSync(profile.quarantine),
    quarantine: profile.quarantine,
    workspaces: workspaceRoots(profile).map(inspectWorkspace),
  };
}

export function resetData(profile: DevelopmentProfile, preview = previewReset(profile)) {
  if (inspectProfile(profile) === "missing") {
    if (preview.exists || preview.workspaces.length > 0) {
      throw new ProfileError(
        "reset-changed",
        "App data changed after the preview. Preview again and retry.",
      );
    }
    return { ...preview, status: "already-empty" as const };
  }

  const lease = acquireProfileMaintenance(profile);

  try {
    validateProfilePaths(profile);
    const roots = workspaceRoots(profile);
    if (JSON.stringify(roots) !== JSON.stringify(preview.workspaces.map(({ root }) => root))) {
      throw new ProfileError(
        "reset-changed",
        "Workspaces changed after the preview. Preview again and retry.",
      );
    }
    const workspaces = roots.map(resetWorkspace);
    const result = { ...preview, workspaces, access: "available" as const };
    if (workspaces.some(({ status }) => status === "blocked")) {
      return { ...result, status: "reset-incomplete" as const };
    }

    rmSync(profile.quarantine, { recursive: true, force: true });
    validateProfilePaths(profile);
    const cleared = { ...result, exists: false, cleanupPending: false };

    if (!existsSync(profile.data)) {
      return { ...cleared, status: "already-empty" as const };
    }

    renameSync(profile.data, profile.quarantine);

    try {
      rmSync(profile.quarantine, { recursive: true, force: true });
      return { ...cleared, status: "reset-complete" as const };
    } catch (error) {
      let message = String(error);
      if (error instanceof Error) {
        message = error.message;
      }
      return {
        ...cleared,
        status: "cleanup-pending" as const,
        cleanupPending: true,
        quarantine: profile.quarantine,
        message,
      };
    }
  } finally {
    lease.release();
  }
}
