import { join } from "node:path";
import { Application } from "@stargeist/application";
import { sqliteLayer } from "@stargeist/database";
import { repositoryLayer as libraryRepositoryLayer } from "@stargeist/database/libraries";
import { LibrariesModule } from "@stargeist/domain/libraries/service";
import { repositoryLayer } from "@stargeist/database/workspaces";
import { WorkspacesModule } from "@stargeist/domain/workspaces/service";
import { Effect, Layer } from "effect";
import { AppDirectories } from "../storage";

const database = Layer.unwrap(
  Effect.map(AppDirectories, ({ data }) =>
    sqliteLayer({ filename: join(data, "stargeist.sqlite") }),
  ),
);

export const BackendApplication = Application.define({
  modules: {
    workspaces: WorkspacesModule,
    libraries: LibrariesModule,
  },
  provide: Layer.merge(repositoryLayer, libraryRepositoryLayer).pipe(Layer.provide(database)),
});

export type BackendServices = Effect.Success<typeof BackendApplication.make>;
