import { lstatSync, readFileSync } from "node:fs";
import { Schema } from "effect";
import { ProfileError } from "./errors";
import type { DevelopmentProfile } from "./paths";

const Owner = Schema.Struct({
  environment: Schema.Literal("development"),
  application: Schema.String,
  identity: Schema.String,
});

const decodeOwner = Schema.decodeUnknownSync(Schema.fromJsonString(Owner));

export function pathStat(path: string) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export function validateDirectory(path: string) {
  const stat = pathStat(path);

  if (stat && (!stat.isDirectory() || stat.isSymbolicLink())) {
    throw new ProfileError("unsafe-path", `Expected an ordinary directory: ${path}`);
  }

  return stat;
}

export function validateFile(path: string) {
  const stat = pathStat(path);

  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)) {
    throw new ProfileError("unsafe-path", `Expected an ordinary file without hard links: ${path}`);
  }

  return stat;
}

export function validateProfilePaths(profile: DevelopmentProfile) {
  for (const path of [
    profile.base,
    profile.controls,
    profile.control,
    profile.root,
    profile.data,
    profile.quarantine,
  ]) {
    validateDirectory(path);
  }

  validateFile(profile.lock);
  validateFile(profile.marker);
}

export function profileOwner(profile: DevelopmentProfile) {
  return {
    environment: "development",
    application: profile.application,
    identity: profile.identity,
  };
}

export function inspectProfile(profile: DevelopmentProfile): "missing" | "unmanaged" | "ready" {
  validateProfilePaths(profile);

  if (!pathStat(profile.root)) {
    return "missing";
  }

  if (!pathStat(profile.marker)) {
    return "unmanaged";
  }

  let owner: typeof Owner.Type;

  try {
    owner = decodeOwner(readFileSync(profile.marker, "utf8"));
  } catch (cause) {
    throw new ProfileError(
      "invalid-owner",
      `The development ownership marker is unreadable: ${profile.marker}`,
      { cause },
    );
  }

  if (owner.application !== profile.application || owner.identity !== profile.identity) {
    throw new ProfileError(
      "invalid-owner",
      `This profile does not belong to the current development checkout: ${profile.root}`,
    );
  }

  return "ready";
}
