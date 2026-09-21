import { existsSync, renameSync, rmSync } from "node:fs";
import {
  inspectProfile,
  validateProfilePaths,
  type DevelopmentProfile,
  acquireProfileMaintenance,
  inspectProfileAccess,
  requireOwnedProfile,
} from "./desktop/index";

export function previewReset(profile: DevelopmentProfile) {
  const ownership = inspectProfile(profile);

  if (ownership === "unmanaged") {
    requireOwnedProfile(profile);
  }

  const access = inspectProfileAccess(profile);

  return {
    command: "reset" as const,
    status: "preview" as const,
    scope: "data" as const,
    profile: profile.root,
    target: profile.data,
    exists: existsSync(profile.data),
    access,
    cleanupPending: existsSync(profile.quarantine),
  };
}

export function resetData(profile: DevelopmentProfile) {
  const preview = previewReset(profile);

  if (inspectProfile(profile) === "missing") {
    return { ...preview, status: "already-empty" as const };
  }

  const lease = acquireProfileMaintenance(profile);

  try {
    validateProfilePaths(profile);
    rmSync(profile.quarantine, { recursive: true, force: true });

    validateProfilePaths(profile);

    const result = {
      ...preview,
      exists: false,
      access: "available" as const,
      cleanupPending: false,
    };

    if (!existsSync(profile.data)) {
      return { ...result, status: "already-empty" as const };
    }

    renameSync(profile.data, profile.quarantine);

    try {
      rmSync(profile.quarantine, { recursive: true, force: true });

      return { ...result, status: "reset-complete" as const };
    } catch (error) {
      return {
        ...result,
        status: "cleanup-pending" as const,
        cleanupPending: true,
        quarantine: profile.quarantine,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    lease.release();
  }
}
