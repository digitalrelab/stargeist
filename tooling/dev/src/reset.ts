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

export function previewReset(profile: DevelopmentProfile) {
  const ownership = inspectProfile(profile);

  if (ownership === "unmanaged") {
    requireOwnedProfile(profile);
  }

  const access = inspectProfileAccess(profile);
  const storage = AppStorage.at(profile.root);

  return {
    command: "reset" as const,
    status: "preview" as const,
    scope: "development" as const,
    profile: profile.root,
    target: profile.data,
    ...storage.inspect(),
    access,
    quarantine: profile.quarantine,
    workspaces: storage.inspectWorkspaces().map((root) => WorkspaceStorage.at(root).inspect()),
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
    const roots = storage.inspectWorkspaces();
    if (JSON.stringify(roots) !== JSON.stringify(preview.workspaces.map(({ root }) => root))) {
      throw new ProfileError(
        "reset-changed",
        "Workspaces changed after the preview. Preview again and retry.",
      );
    }
    const targets = roots.map((root) => WorkspaceStorage.at(root));
    if (
      targets.some((target, index) => target.inspect().status !== preview.workspaces[index]?.status)
    ) {
      throw new ProfileError(
        "reset-changed",
        "Workspaces changed after the preview. Preview again and retry.",
      );
    }
    const workspaces = targets.map((target) => target.reset());
    const result = { ...preview, workspaces, access: "available" as const };
    if (workspaces.some(({ status }) => status === "blocked")) {
      return { ...result, status: "reset-incomplete" as const };
    }

    validateProfilePaths(profile);
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
