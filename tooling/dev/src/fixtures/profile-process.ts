import {
  developmentProfile,
  acquireProfileMaintenance,
  holdProfileUntilExit,
  initializeProfile,
  ProfileError,
} from "../desktop/index";

const [action, application, appData] = process.argv.slice(2);

if (!application || !appData) {
  throw new Error("Missing isolated profile paths.");
}

const profile = developmentProfile(application, appData);

try {
  if (action === "initialize") {
    initializeProfile(profile);
  } else if (action === "maintain") {
    acquireProfileMaintenance(profile);
  } else {
    holdProfileUntilExit(profile);
  }

  process.send?.({ ready: true });
  setInterval(() => {}, 1000);
} catch (error) {
  const code = error instanceof ProfileError ? error.code : String(error);

  process.send?.({ error: code });
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
