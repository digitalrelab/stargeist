import { Application } from "@stargeist/application";
import { databaseLayer } from "@stargeist/database";
import { Effect, Layer } from "effect";
import { FilesModule } from "../files";
import { StoragePaths } from "../storage";
import { WorkspacesModule } from "../workspaces";

const storage = Layer.unwrap(
  Effect.gen(function* () {
    const paths = yield* StoragePaths;
    return databaseLayer(paths.database);
  }),
);

export const BackendApplication = Application.define({
  modules: { workspaces: WorkspacesModule, files: FilesModule },
  provide: storage,
});
