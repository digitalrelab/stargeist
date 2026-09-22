import { WorkspaceControlEndpoint, WorkspaceEndpoint } from "../workspaces";
import { servePort } from "./port";

export const backendIpc = {
  control: servePort(WorkspaceControlEndpoint.serve),
  renderer: servePort(WorkspaceEndpoint.serve),
};
