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

function targetIdentity(path: string) {
  const target = lstatSync(path, { bigint: true, throwIfNoEntry: false });
  if (!target) {
    return null;
  }
  return `${target.dev}:${target.ino}:${target.birthtimeNs}`;
}

export function previewReset(profile: DevelopmentProfile) {
  const ownership = inspectProfile(profile);

  if (ownership === "unmanaged") {
    requireOwnedProfile(profile);
  }

  const access = inspectProfileAccess(profile);
  const storage = AppStorage.at(profile.root);
  const workspaces = storage.inspectWorkspaces().map((root) => WorkspaceStorage.at(root).inspect());

  return {
    command: "reset" as const,
    status: "preview" as const,
    scope: "development" as const,
    profile: profile.root,
    target: profile.data,
    ...storage.inspect(),
    access,
    quarantine: profile.quarantine,
    workspaces,
    [resetTargets]: {
      data: targetIdentity(profile.data),
      quarantine: targetIdentity(profile.quarantine),
      workspaces: workspaces.map(({ path }) => targetIdentity(path)),
    },
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
    const storage = AppStorage.at(profile.root);
    const targetsBefore = preview[resetTargets];
    const appTargetsChanged = () =>
      targetIdentity(profile.data) !== targetsBefore.data ||
      targetIdentity(profile.quarantine) !== targetsBefore.quarantine;
    if (appTargetsChanged()) {
      throw new ProfileError(
        "reset-changed",
        "App data changed after the preview. Preview again and retry.",
      );
    }
    const roots = storage.inspectWorkspaces();
    if (JSON.stringify(roots) !== JSON.stringify(preview.workspaces.map(({ root }) => root))) {
      throw new ProfileError(
        "reset-changed",
        "Workspaces changed after the preview. Preview again and retry.",
      );
    }
    const targets = roots.map((root) => WorkspaceStorage.at(root));
    const workspaceChanged = (target: (typeof targets)[number], index: number) =>
      target.inspect().status !== preview.workspaces[index]?.status ||
      targetIdentity(preview.workspaces[index]!.path) !== targetsBefore.workspaces[index];
    if (targets.some(workspaceChanged)) {
      throw new ProfileError(
        "reset-changed",
        "Workspaces changed after the preview. Preview again and retry.",
      );
    }
    const workspaces = targets.map((target, index) => {
      if (workspaceChanged(target, index)) {
        throw new ProfileError(
          "reset-changed",
          "Workspaces changed after the preview. Preview again and retry.",
        );
      }
      return target.reset();
    });
    const result = { ...preview, workspaces, access: "available" as const };
    if (workspaces.some(({ status }) => status === "blocked")) {
      return { ...result, status: "reset-incomplete" as const };
    }

    validateProfilePaths(profile);
    if (appTargetsChanged()) {
      throw new ProfileError(
        "reset-changed",
        "App data changed after the preview. Preview again and retry.",
      );
    }
    const outcome = storage.reset();
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
