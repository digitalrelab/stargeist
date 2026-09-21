import { join } from "node:path";
import { app } from "electron";

export function applicationIcon() {
  if (app.isPackaged) {
    return join(process.resourcesPath, "icon.png");
  }

  return join(app.getAppPath(), "icons", "icon.png");
}
