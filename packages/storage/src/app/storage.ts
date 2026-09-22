import { lstatSync, realpathSync, renameSync, rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { Context, Effect, Layer } from "effect";
import { AppDatabase, openDatabase } from "./database";
import { temporarySession } from "./temporary";
import { readWorkspaceRoots } from "../workspaces/inspection";
import { StorageError } from "../errors";

function at(profile: string) {
  const directory = join(profile, "data");
  const database = join(directory, "application.sqlite");
  const quarantine = join(profile, ".discarded-data");
  const ordinaryDirectory = (path: string) => {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) {
      throw new StorageError("unsafe-path", `Expected an ordinary directory: ${path}`);
    }
    return stat;
  };
  const inspect = () => {
    if (!isAbsolute(profile) || resolve(profile) !== profile) {
      throw new StorageError("unsafe-path", `Expected an absolute profile path: ${profile}`);
    }
    if (ordinaryDirectory(profile) && realpathSync(profile) !== profile) {
      throw new StorageError("unsafe-path", `The profile path has been redirected: ${profile}`);
    }
    return {
      exists: Boolean(ordinaryDirectory(directory)),
      cleanupPending: Boolean(ordinaryDirectory(quarantine)),
    };
  };

  return {
    profile,
    directory,
    quarantine,
    userPreferences: join(directory, "user-preferences.json"),
    credentials: join(directory, "credentials"),
    openDatabase: openDatabase(database),
    temporarySession: temporarySession(join(profile, "temporary")),
    inspect,
    inspectWorkspaces() {
      inspect();
      const file = lstatSync(database, { throwIfNoEntry: false });
      if (!file) return [];
      if (!file.isFile())
        throw new StorageError("unsafe-path", `Expected an ordinary file: ${database}`);
      try {
        return readWorkspaceRoots(database);
      } catch (cause) {
        throw new StorageError(
          "workspace-registry-unavailable",
          "Known workspaces could not be read. App data was kept.",
          { cause },
        );
      }
    },
    reset() {
      inspect();
      rmSync(quarantine, { recursive: true, force: true });
      if (!inspect().exists) return { status: "already-empty" as const };
      renameSync(directory, quarantine);
      try {
        rmSync(quarantine, { recursive: true, force: true });
        return { status: "reset-complete" as const };
      } catch (error) {
        let message = String(error);
        if (error instanceof Error) message = error.message;
        return { status: "cleanup-pending" as const, message };
      }
    },
  };
}

export class AppStorage extends Context.Service<AppStorage, ReturnType<typeof at>>()(
  "@stargeist/storage/AppStorage",
) {
  static readonly at = at;
  static readonly layer = (profile: string) => Layer.succeed(AppStorage, at(profile));
  static readonly database = Layer.effect(
    AppDatabase,
    Effect.gen(function* () {
      const storage = yield* AppStorage;
      return yield* storage.openDatabase;
    }),
  );
}

export class TemporaryStorage extends Context.Service<
  TemporaryStorage,
  { readonly directory: string }
>()("@stargeist/storage/TemporaryStorage") {}

export const temporaryStorageLayer = Layer.effect(
  TemporaryStorage,
  Effect.gen(function* () {
    const storage = yield* AppStorage;
    return { directory: yield* storage.temporarySession };
  }),
);
