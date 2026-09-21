import { join } from "node:path";
import { Application } from "@stargeist/application";
import { sqliteLayer } from "@stargeist/database";
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
  modules: { workspaces: WorkspacesModule },
  provide: repositoryLayer.pipe(Layer.provide(database)),
});
