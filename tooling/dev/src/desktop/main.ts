import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { app } from "electron";
import { initializeProfile, holdProfileUntilExit } from "./coordination";
import { developmentProfile } from "./paths";

const appData = app.getPath("appData");
const profile = developmentProfile(STARGEIST_DESKTOP_DIRECTORY, appData);

initializeProfile(profile);
holdProfileUntilExit(profile);

const crashes = join(profile.root, "crashes");
mkdirSync(crashes, { recursive: true });

app.setPath("userData", profile.root);
app.setPath("sessionData", profile.root);
app.setPath("crashDumps", crashes);
app.setAppLogsPath(join(profile.root, "logs"));

process.env.STARGEIST_DEV_APP_DATA = appData;
