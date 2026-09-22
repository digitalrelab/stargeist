import { Application } from "@stargeist/application";
import { WorkspacesModule } from "../workspaces";

export const BackendApplication = Application.define({ modules: { workspaces: WorkspacesModule } });
