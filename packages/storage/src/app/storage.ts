import { lstatSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { AppDatabase, openDatabase } from "./database";
import { temporarySession } from "./temporary";
import { readWorkspaceRoots } from "../workspaces/inspection";
import { StorageError } from "../errors";
import { inspectDirectory, inspectRoot } from "../directory";

const databaseFilename = "application.sqlite";

function at(profile: string) {
  const directory = join(profile, "data");
  const database = join(directory, databaseFilename);
  const quarantine = join(profile, ".discarded-data");
  const inspect = () => {
    inspectRoot(profile);
    return {
      exists: inspectDirectory(directory),
      cleanupPending: inspectDirectory(quarantine),
    };
  };

  return {
    profile,
    directory,
    quarantine,
    userPreferences: join(directory, "user-preferences.json"),
    credentials: join(directory, "credentials"),
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
      return yield* openDatabase(join(storage.directory, databaseFilename));
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
