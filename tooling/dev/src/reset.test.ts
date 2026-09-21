import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  developmentProfile,
  inspectProfile,
  acquireProfileMaintenance,
  holdProfileUntilExit,
  initializeProfile,
  inspectProfileAccess,
} from "./desktop/index";
import { expect, it, onTestFinished } from "vite-plus/test";
import { previewReset, resetData } from "./reset";

const require = createRequire(import.meta.url);
const loader = require.resolve("tsx");
const worker = fileURLToPath(new URL("./fixtures/profile-process.ts", import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stargeist profile "));
  const application = join(root, "checkout");
  const appData = join(root, "appData");

  mkdirSync(application);
  mkdirSync(appData);
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));

  return { root, application, appData, profile: developmentProfile(application, appData) };
}

async function holder(action: string, application: string, appData: string) {
  const child = spawn(
    process.execPath,
    ["--import", loader, worker, action, application, appData],
    {
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    },
  );

  onTestFinished(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await kill(child);
    }
  });

  const message = await Promise.race([
    once(child, "message").then(([value]) => value),
    once(child, "exit").then(([code]) => {
      throw new Error(`Profile holder exited early: ${code}`);
    }),
  ]);

  expect(message).toEqual({ ready: true });

  return child;
}

async function kill(child: ChildProcess) {
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
}

it("previews a missing profile without creating profile or coordination files", () => {
  const { profile } = fixture();

  expect(previewReset(profile)).toMatchObject({
    status: "preview",
    exists: false,
    access: "not-initialized",
  });
  expect(resetData(profile).status).toBe("already-empty");
  expect(existsSync(profile.base)).toBe(false);
});

it("requires explicit desktop adoption and refuses a foreign ownership marker", () => {
  const { profile } = fixture();
  mkdirSync(profile.data, { recursive: true });
  writeFileSync(join(profile.data, "stargeist.sqlite"), "keep");

  expect(() => resetData(profile)).toThrow(/Start the updated desktop/);

  initializeProfile(profile);
  expect(inspectProfile(profile)).toBe("ready");

  const owner = JSON.parse(readFileSync(profile.marker, "utf8"));
  writeFileSync(profile.marker, JSON.stringify({ ...owner, identity: "another-checkout" }));

  expect(() => resetData(profile)).toThrow(/does not belong/);
  expect(readFileSync(join(profile.data, "stargeist.sqlite"), "utf8")).toBe("keep");
});

it("resets the data directory as a unit, preserves other state, and leaves another checkout intact", () => {
  const { root, application, appData, profile } = fixture();
  const otherApplication = join(root, "other checkout");
  mkdirSync(otherApplication);

  const other = developmentProfile(otherApplication, appData);
  initializeProfile(profile);
  initializeProfile(other);

  for (const target of [profile, other]) {
    mkdirSync(target.data);
    writeFileSync(join(target.data, "stargeist.sqlite"), "database");
    writeFileSync(`${join(target.data, "stargeist.sqlite")}-wal`, "wal");
    writeFileSync(`${join(target.data, "stargeist.sqlite")}-shm`, "shm");
  }

  writeFileSync(join(profile.root, "Preferences"), "browser state");
  writeFileSync(join(application, "source.txt"), "source files");
  const originalMarker = readFileSync(profile.marker, "utf8");

  expect(resetData(profile).status).toBe("reset-complete");
  expect(existsSync(profile.data)).toBe(false);
  expect(existsSync(profile.quarantine)).toBe(false);
  expect(readFileSync(join(other.data, "stargeist.sqlite"), "utf8")).toBe("database");
  expect(readFileSync(join(profile.root, "Preferences"), "utf8")).toBe("browser state");
  expect(readFileSync(join(application, "source.txt"), "utf8")).toBe("source files");
  expect(readFileSync(profile.marker, "utf8")).toBe(originalMarker);
  expect(resetData(profile).status).toBe("already-empty");
});

it("cleans an interrupted detached reset before resetting new data", () => {
  const { profile } = fixture();
  initializeProfile(profile);
  mkdirSync(profile.quarantine);
  writeFileSync(join(profile.quarantine, "old.sqlite"), "old data");
  mkdirSync(profile.data);
  writeFileSync(join(profile.data, "stargeist.sqlite"), "new data");

  expect(previewReset(profile).cleanupPending).toBe(true);
  expect(resetData(profile).status).toBe("reset-complete");
  expect(existsSync(profile.quarantine)).toBe(false);
  expect(existsSync(profile.data)).toBe(false);
});

it.each(["data", "quarantine", "root"] as const)("refuses a redirected %s directory", (target) => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const external = join(root, "external");
  mkdirSync(external);
  writeFileSync(join(external, "precious.txt"), "preserve");

  if (target === "root") {
    rmSync(profile.root, { recursive: true });
  }
  symlinkSync(external, profile[target], process.platform === "win32" ? "junction" : "dir");

  expect(() => resetData(profile)).toThrow(/ordinary directory/);
  expect(readFileSync(join(external, "precious.txt"), "utf8")).toBe("preserve");
});

it("refuses reset until both independently running consumers exit, including abrupt host death", async () => {
  const { profile, application, appData } = fixture();
  initializeProfile(profile);
  mkdirSync(profile.data);
  writeFileSync(join(profile.data, "stargeist.sqlite"), "live database");

  const host = await holder("use", application, appData);
  const backend = await holder("use", application, appData);

  expect(inspectProfileAccess(profile)).toBe("busy");
  expect(() => resetData(profile)).toThrow(/in use/);

  await kill(host);
  expect(() => resetData(profile)).toThrow(/in use/);
  expect(readFileSync(join(profile.data, "stargeist.sqlite"), "utf8")).toBe("live database");

  await kill(backend);
  expect(resetData(profile).status).toBe("reset-complete");
});

it("blocks startup and a second reset while maintenance holds exclusive access", async () => {
  const { profile, application, appData } = fixture();
  initializeProfile(profile);
  const maintenance = await holder("maintain", application, appData);

  expect(() => holdProfileUntilExit(profile)).toThrow(/in use/);
  expect(() => acquireProfileMaintenance(profile)).toThrow(/in use/);

  await kill(maintenance);
  expect(inspectProfileAccess(profile)).toBe("available");
});

it("rejects Bun before loading the unsupported native addon", () => {
  const { application, appData } = fixture();
  const result = spawnSync("bun", [worker, "initialize", application, appData], {
    encoding: "utf8",
    timeout: 10000,
  });

  expect(result.status).toBe(1);
  expect(result.signal).toBeNull();
  expect(result.stderr).toContain("unsupported-runtime");
  expect(result.stderr).not.toContain("panic");
});
