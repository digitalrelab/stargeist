import { Application } from "@stargeist/application";
import { AppStorage } from "@stargeist/storage";
import { FilesModule } from "../files";
import { WorkspacesModule } from "../workspaces";

export const BackendApplication = Application.define({
  modules: { workspaces: WorkspacesModule, files: FilesModule },
  provide: AppStorage.database,
});
