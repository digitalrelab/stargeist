import { join } from "node:path";
import { Context, Layer } from "effect";

export class StoragePaths extends Context.Service<
  StoragePaths,
  {
    readonly profile: string;
    readonly database: string;
    readonly userPreferences: string;
    readonly credentials: string;
    readonly temporary: string;
  }
>()("@stargeist/desktop/StoragePaths") {}

export const pathsLayer = (profile: string) =>
  Layer.succeed(StoragePaths, {
    profile,
    database: join(profile, "data", "stargeist.sqlite"),
    userPreferences: join(profile, "data", "user-preferences.json"),
    credentials: join(profile, "data", "credentials"),
    temporary: join(profile, "temporary"),
  });
