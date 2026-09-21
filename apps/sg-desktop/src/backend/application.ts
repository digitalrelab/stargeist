import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { Application } from "@stargeist/application";
import { sqliteLayer } from "@stargeist/database";
import { repositoryLayer as libraryRepositoryLayer } from "@stargeist/database/libraries";
import { LibrariesModule } from "@stargeist/domain/libraries/service";
import { repositoryLayer } from "@stargeist/database/workspaces";
import { WorkspacesModule } from "@stargeist/domain/workspaces/service";
import { Effect, Layer } from "effect";
import { StoragePaths } from "../storage";

const database = Layer.unwrap(
  Effect.gen(function* () {
    const { database } = yield* StoragePaths;
    yield* Effect.promise(() => mkdir(dirname(database), { recursive: true }));
    return sqliteLayer({ filename: database });
  }),
);

export const BackendApplication = Application.define({
  modules: {
    workspaces: WorkspacesModule,
    libraries: LibrariesModule,
  },
  provide: Layer.merge(repositoryLayer, libraryRepositoryLayer).pipe(Layer.provide(database)),
});

export type BackendServices = Effect.Success<typeof BackendApplication.make>;
