import { lstatSync } from "node:fs";
import { AppStorage, WorkspaceStorage } from "@stargeist/storage";
import {
  inspectProfile,
  validateProfilePaths,
  type DevelopmentProfile,
  acquireProfileMaintenance,
  inspectProfileAccess,
  requireOwnedProfile,
  ProfileError,
} from "./desktop/index";

const resetTargets = Symbol("resetTargets");
const changed = () =>
  new ProfileError("reset-changed", "Reset targets changed after the preview. Preview again.");

function targetIdentity(path: string) {
  const target = lstatSync(path, { bigint: true, throwIfNoEntry: false });
  if (!target) {
    return null;
  }
  return `${target.dev}:${target.ino}:${target.birthtimeNs}`;
}

function inspectTargets(profile: DevelopmentProfile) {
  const storage = AppStorage.at(profile.root);
  const app = storage.inspect();
  const workspaces = storage.inspectWorkspaces().map((root) => WorkspaceStorage.at(root).inspect());
  const identities = {
    data: targetIdentity(profile.data),
    quarantine: targetIdentity(profile.quarantine),
    workspaces: workspaces.map(({ root, path, status }) => ({
      root,
      status,
      identity: targetIdentity(path),
    })),
  };
  return { storage, app, workspaces, identities };
}

export function previewReset(profile: DevelopmentProfile) {
  const ownership = inspectProfile(profile);

  if (ownership === "unmanaged") {
    requireOwnedProfile(profile);
  }

  const access = inspectProfileAccess(profile);
  const { app, workspaces, identities } = inspectTargets(profile);

  return {
    command: "reset" as const,
    status: "preview" as const,
    scope: "development" as const,
    profile: profile.root,
    target: profile.data,
    ...app,
    access,
    quarantine: profile.quarantine,
    workspaces,
    [resetTargets]: identities,
  };
}

export function resetData(profile: DevelopmentProfile, preview = previewReset(profile)) {
  if (inspectProfile(profile) === "missing") {
    if (preview.exists || preview.workspaces.length > 0) {
      throw changed();
    }
    return { ...preview, status: "already-empty" as const };
  }

  const lease = acquireProfileMaintenance(profile);

  try {
    validateProfilePaths(profile);
    const current = inspectTargets(profile);
    const expected = preview[resetTargets];
    if (JSON.stringify(current.identities) !== JSON.stringify(expected)) {
      throw changed();
    }
    const workspaces = current.workspaces.map(({ root, path }, index) => {
      if (targetIdentity(path) !== expected.workspaces[index]!.identity) {
        throw changed();
      }
      return WorkspaceStorage.at(root).reset();
    });
    const result = { ...preview, workspaces, access: "available" as const };
    if (workspaces.some(({ status }) => status === "blocked")) {
      return { ...result, status: "reset-incomplete" as const };
    }

    validateProfilePaths(profile);
    if (
      targetIdentity(profile.data) !== expected.data ||
      targetIdentity(profile.quarantine) !== expected.quarantine
    ) {
      throw changed();
    }
    const outcome = current.storage.reset();
    return {
      ...result,
      ...outcome,
      exists: false,
      cleanupPending: outcome.status === "cleanup-pending",
    };
  } finally {
    lease.release();
  }
}
