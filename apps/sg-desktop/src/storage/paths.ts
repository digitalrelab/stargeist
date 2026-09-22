import { join } from "node:path";
import { Context, Layer } from "effect";

export class StoragePaths extends Context.Service<
  StoragePaths,
  {
    readonly profile: string;
    readonly database: string;
    readonly userPreferences: string;
    readonly temporary: string;
  }
>()("@stargeist/desktop/StoragePaths") {}

export const pathsLayer = (profile: string) =>
  Layer.succeed(StoragePaths, {
    profile,
    database: join(profile, "data", "workspaces.sqlite"),
    userPreferences: join(profile, "data", "user-preferences.json"),
    temporary: join(profile, "temporary"),
  });
