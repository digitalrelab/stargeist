import { lstatSync, readFileSync } from "node:fs";
import { Schema } from "effect";
import { AppStorage } from "@stargeist/storage";
import { ProfileError } from "./errors";
import type { DevelopmentProfile } from "./paths";

const Owner = Schema.Struct({
  environment: Schema.Literal("development"),
  application: Schema.String,
  identity: Schema.String,
});

const decodeOwner = Schema.decodeUnknownSync(Schema.fromJsonString(Owner));

export function validateFile(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false });

  if (stat && (!stat.isFile() || stat.nlink !== 1)) {
    throw new ProfileError("unsafe-path", `Expected an ordinary file without hard links: ${path}`);
  }

  return stat;
}

export function validateProfilePaths(profile: DevelopmentProfile) {
  for (const path of [profile.base, profile.controls, profile.control]) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) {
      throw new ProfileError("unsafe-path", `Expected an ordinary directory: ${path}`);
    }
  }

  AppStorage.at(profile.root).inspect();

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

  if (!lstatSync(profile.root, { throwIfNoEntry: false })) {
    return "missing";
  }

  if (!lstatSync(profile.marker, { throwIfNoEntry: false })) {
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
