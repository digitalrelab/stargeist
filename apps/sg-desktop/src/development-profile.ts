import { createHash } from "node:crypto";
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { Effect } from "effect";

export const configureDevelopmentProfile = Effect.sync(() => {
  if (app.isPackaged) return;

  const appPath = realpathSync(app.getAppPath());
  const identity = createHash("sha256")
    .update(process.platform === "win32" ? appPath.toLowerCase() : appPath)
    .digest("hex")
    .slice(0, 16);
  const profilePath = join(app.getPath("appData"), "Stargeist-development", identity);
  const crashPath = join(profilePath, "crashes");

  mkdirSync(crashPath, { recursive: true });
  app.setPath("userData", profilePath);
  app.setPath("sessionData", profilePath);
  app.setPath("crashDumps", crashPath);
  app.setAppLogsPath(join(profilePath, "logs"));
});
