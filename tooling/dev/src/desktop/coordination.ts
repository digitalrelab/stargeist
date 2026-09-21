import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { ProfileError } from "./errors";
import {
  inspectProfile,
  pathStat,
  profileOwner,
  validateFile,
  validateProfilePaths,
} from "./ownership";
import type { DevelopmentProfile } from "./paths";
import { loadNativeLocks as loadAddon } from "./native.cjs";

function loadNativeLocks() {
  if (process.versions.bun) {
    throw new ProfileError(
      "unsupported-runtime",
      "Profile coordination requires Node or Electron. Run the CLI with bun run sg, not bun src/main.ts.",
    );
  }

  try {
    return loadAddon();
  } catch (cause) {
    throw new ProfileError(
      "coordination-unavailable",
      "Native profile coordination could not load. Run bun install and check this platform's native addon support.",
      { cause },
    );
  }
}

function openLockFile(profile: DevelopmentProfile, create: boolean) {
  validateProfilePaths(profile);

  if (create) {
    mkdirSync(profile.control, { recursive: true });
  }

  validateProfilePaths(profile);

  const before = validateFile(profile.lock);

  if (!before && !create) {
    throw new ProfileError(
      "coordination-unavailable",
      "The profile lock is missing. Start the updated desktop once before resetting it.",
    );
  }

  const fd = openSync(
    profile.lock,
    constants.O_RDWR | (create ? constants.O_CREAT : 0) | (constants.O_NOFOLLOW ?? 0),
    0o600,
  );

  try {
    const opened = fstatSync(fd);
    const current = validateFile(profile.lock);

    if (
      !current ||
      opened.ino !== current.ino ||
      opened.dev !== current.dev ||
      opened.nlink !== 1
    ) {
      throw new ProfileError("unsafe-path", "The profile lock changed while being opened.");
    }

    return fd;
  } catch (error) {
    closeSync(fd);
    throw error;
  }
}

function acquire(
  profile: DevelopmentProfile,
  { shared = false, create = false }: { shared?: boolean; create?: boolean } = {},
) {
  const locks = loadNativeLocks();
  const fd = openLockFile(profile, create);

  try {
    if (!locks.tryLock(fd, { shared })) {
      throw new ProfileError(
        "profile-busy",
        "This development profile is in use. Close its desktop app and backend, then retry.",
      );
    }

    validateProfilePaths(profile);
  } catch (error) {
    closeSync(fd);
    throw error;
  }

  let released = false;

  return {
    release() {
      if (released) {
        return;
      }

      released = true;
      closeSync(fd);
    },
  };
}

export function initializeProfile(profile: DevelopmentProfile) {
  if (inspectProfile(profile) === "ready") {
    return;
  }

  const lease = acquire(profile, { create: true });

  try {
    if (inspectProfile(profile) === "ready") {
      return;
    }

    mkdirSync(profile.root, { recursive: true });
    validateProfilePaths(profile);

    const temporary = join(profile.control, `owner-${randomUUID()}.json`);

    try {
      writeFileSync(temporary, JSON.stringify(profileOwner(profile)), { flag: "wx", mode: 0o600 });
      renameSync(temporary, profile.marker);
    } finally {
      rmSync(temporary, { force: true });
    }
  } finally {
    lease.release();
  }
}

export function holdProfileUntilExit(profile: DevelopmentProfile) {
  const lease = acquire(profile, { shared: true });

  try {
    requireOwnedProfile(profile);
  } catch (error) {
    lease.release();
    throw error;
  }
}

export function requireOwnedProfile(profile: DevelopmentProfile) {
  if (inspectProfile(profile) !== "ready") {
    throw new ProfileError(
      "unmanaged-profile",
      "Start the updated desktop once to establish ownership before resetting this profile. Close older development instances first.",
    );
  }
}

export function acquireProfileMaintenance(profile: DevelopmentProfile) {
  requireOwnedProfile(profile);

  const lease = acquire(profile);

  try {
    requireOwnedProfile(profile);

    return lease;
  } catch (error) {
    lease.release();
    throw error;
  }
}

export function inspectProfileAccess(
  profile: DevelopmentProfile,
): "not-initialized" | "available" | "busy" {
  loadNativeLocks();
  validateProfilePaths(profile);

  if (!pathStat(profile.lock)) {
    return "not-initialized";
  }

  try {
    const lease = acquire(profile);
    lease.release();

    return "available";
  } catch (error) {
    if (error instanceof ProfileError && error.code === "profile-busy") {
      return "busy";
    }

    throw error;
  }
}
