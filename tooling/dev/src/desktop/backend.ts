import { holdProfileUntilExit } from "./coordination";
import { ProfileError } from "./errors";
import { developmentProfile } from "./paths";

const appData = process.env.STARGEIST_DEV_APP_DATA;

if (!appData) {
  throw new ProfileError(
    "invalid-environment",
    "The development backend requires the desktop's app-data context.",
  );
}

const profile = developmentProfile(STARGEIST_DESKTOP_DIRECTORY, appData);

if (profile.root !== process.argv[2]) {
  throw new ProfileError(
    "unsafe-path",
    "The backend profile does not match its development checkout.",
  );
}

holdProfileUntilExit(profile);
