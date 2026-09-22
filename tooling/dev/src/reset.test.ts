import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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
import { rememberWorkspaces } from "./workspaces.test-support";

const require = createRequire(import.meta.url);
const loader = pathToFileURL(require.resolve("tsx")).href;
const worker = fileURLToPath(new URL("./fixtures/profile-process.ts", import.meta.url));

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "stargeist profile ")));
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

  let stderr = "";

  child.stderr?.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });

  onTestFinished(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      await kill(child);
    }
  });

  const message = await Promise.race([
    once(child, "message").then(([value]) => value),
    once(child, "exit").then(([code]) => {
      throw new Error(`Profile holder exited early (${code}): ${stderr}`);
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

it("previews and resets registered nested workspaces while preserving ordinary files and unknown workspaces", async () => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const parent = join(root, "workspace");
  const child = join(parent, "child");
  const unknown = join(parent, "unknown");
  const missing = join(root, "missing");
  for (const folder of [parent, child, unknown]) {
    mkdirSync(join(folder, ".stargeist"), { recursive: true });
    writeFileSync(join(folder, ".stargeist", "workspace.json"), "old or invalid metadata");
    writeFileSync(join(folder, "notes.txt"), "ordinary file");
  }
  await rememberWorkspaces(profile, [parent, child, missing]);
  writeFileSync(join(profile.data, "user-preferences.json"), "preferences");
  const before = readFileSync(join(profile.data, "application.sqlite"));

  const preview = previewReset(profile);
  expect(preview.workspaces).toEqual([
    { root: missing, path: join(missing, ".stargeist"), status: "missing" },
    { root: parent, path: join(parent, ".stargeist"), status: "ready" },
    { root: child, path: join(child, ".stargeist"), status: "ready" },
  ]);
  expect(readFileSync(join(profile.data, "application.sqlite"))).toEqual(before);
  expect(existsSync(join(parent, ".stargeist"))).toBe(true);

  const result = resetData(profile, preview);
  expect(result.status).toBe("reset-complete");
  expect(result.workspaces.map(({ status }) => status)).toEqual(["missing", "removed", "removed"]);
  for (const folder of [parent, child]) {
    expect(existsSync(join(folder, ".stargeist"))).toBe(false);
    expect(readFileSync(join(folder, "notes.txt"), "utf8")).toBe("ordinary file");
  }
  expect(readFileSync(join(unknown, ".stargeist", "workspace.json"), "utf8")).toBe(
    "old or invalid metadata",
  );
  expect(existsSync(profile.data)).toBe(false);
  expect(resetData(profile).status).toBe("already-empty");
});

it("preserves the registry after partial cleanup and retries the remaining workspace", async () => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const first = join(root, "first");
  const second = join(root, "second");
  const outside = join(root, "outside");
  mkdirSync(join(first, ".stargeist"), { recursive: true });
  mkdirSync(second);
  mkdirSync(outside);
  writeFileSync(join(outside, "preserve.txt"), "preserve");
  let linkType: "dir" | "junction" = "dir";
  if (process.platform === "win32") {
    linkType = "junction";
  }
  symlinkSync(outside, join(second, ".stargeist"), linkType);
  await rememberWorkspaces(profile, [first, second]);
  const before = readFileSync(join(profile.data, "application.sqlite"));

  const failed = resetData(profile);
  expect(failed.status).toBe("reset-incomplete");
  expect(failed.workspaces.map(({ status }) => status)).toEqual(["removed", "blocked"]);
  expect(readFileSync(join(profile.data, "application.sqlite"))).toEqual(before);
  expect(readFileSync(join(outside, "preserve.txt"), "utf8")).toBe("preserve");

  rmSync(join(second, ".stargeist"));
  mkdirSync(join(second, ".stargeist"));
  const retried = resetData(profile);
  expect(retried.status).toBe("reset-complete");
  expect(retried.workspaces.map(({ status }) => status)).toEqual(["missing", "removed"]);
  expect(existsSync(profile.data)).toBe(false);
});

it.runIf(process.platform !== "win32" && process.getuid?.() !== 0)(
  "preserves registry data when metadata deletion fails and completes after permissions are repaired",
  async () => {
    const { root, profile } = fixture();
    initializeProfile(profile);
    const workspace = join(root, "workspace");
    const metadata = join(workspace, ".stargeist");
    mkdirSync(metadata, { recursive: true });
    writeFileSync(join(metadata, "workspace.json"), "old metadata");
    await rememberWorkspaces(profile, [workspace]);
    chmodSync(metadata, 0o555);
    try {
      expect(previewReset(profile).workspaces[0]?.status).toBe("ready");
      const result = resetData(profile);
      expect(result.status).toBe("reset-incomplete");
      expect(result.workspaces[0]).toMatchObject({ status: "blocked", path: metadata });
      expect(existsSync(join(profile.data, "application.sqlite"))).toBe(true);
    } finally {
      chmodSync(metadata, 0o755);
    }
    expect(resetData(profile).status).toBe("reset-complete");
    expect(existsSync(metadata)).toBe(false);
  },
);

it("requires a new preview if registered workspaces change before reset", async () => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const first = join(root, "first");
  const added = join(root, "added");
  mkdirSync(join(first, ".stargeist"), { recursive: true });
  mkdirSync(join(added, ".stargeist"), { recursive: true });
  await rememberWorkspaces(profile, [first]);
  const preview = previewReset(profile);
  await rememberWorkspaces(profile, [added]);
  expect(() => resetData(profile, preview)).toThrow(/changed after the preview/);
  expect(existsSync(join(first, ".stargeist"))).toBe(true);
  expect(existsSync(join(added, ".stargeist"))).toBe(true);
  expect(existsSync(profile.data)).toBe(true);
});

it("refuses a stale preview when the profile disappears before reset", async () => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const workspace = join(root, "workspace");
  mkdirSync(join(workspace, ".stargeist"), { recursive: true });
  await rememberWorkspaces(profile, [workspace]);
  const preview = previewReset(profile);
  rmSync(profile.root, { recursive: true });

  expect(() => resetData(profile, preview)).toThrow(/changed after the preview/);
  expect(existsSync(join(workspace, ".stargeist"))).toBe(true);
});

it("preserves application data when the workspace registry cannot be read", () => {
  const { profile } = fixture();
  initializeProfile(profile);
  mkdirSync(profile.data);
  const database = join(profile.data, "application.sqlite");
  writeFileSync(database, "unreadable registry");
  expect(() => previewReset(profile)).toThrow(/Known workspaces could not be read/);
  expect(() => resetData(profile)).toThrow(/Known workspaces could not be read/);
  expect(readFileSync(database, "utf8")).toBe("unreadable registry");
});

it.each(["root", "ancestor"])("refuses a workspace redirected through its %s", async (target) => {
  const { root, profile } = fixture();
  initializeProfile(profile);
  const parent = join(root, "parent");
  const workspace = join(parent, "workspace");
  const outside = join(root, "outside");
  mkdirSync(join(workspace, ".stargeist"), { recursive: true });
  writeFileSync(join(workspace, ".stargeist", "workspace.json"), "preserve");
  await rememberWorkspaces(profile, [workspace]);
  let replaced = workspace;
  if (target === "ancestor") {
    replaced = parent;
  }
  renameSync(replaced, outside);
  let linkType: "dir" | "junction" = "dir";
  if (process.platform === "win32") {
    linkType = "junction";
  }
  symlinkSync(outside, replaced, linkType);
  expect(resetData(profile).status).toBe("reset-incomplete");
  expect(readFileSync(join(workspace, ".stargeist", "workspace.json"), "utf8")).toBe("preserve");
  expect(existsSync(profile.data)).toBe(true);
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
  let linkType: "dir" | "junction" = "dir";
  if (process.platform === "win32") {
    linkType = "junction";
  }
  symlinkSync(external, profile[target], linkType);

  expect(() => resetData(profile)).toThrow(/ordinary directory/);
  expect(readFileSync(join(external, "precious.txt"), "utf8")).toBe("preserve");
});

it("refuses reset until both independently running consumers exit, including abrupt host death", async () => {
  const { profile, application, appData } = fixture();
  initializeProfile(profile);
  mkdirSync(join(application, ".stargeist"));
  await rememberWorkspaces(profile, [application]);
  writeFileSync(join(profile.data, "stargeist.sqlite"), "live database");

  const [host, backend] = await Promise.all([
    holder("use", application, appData),
    holder("use", application, appData),
  ]);

  expect(inspectProfileAccess(profile)).toBe("busy");
  expect(() => resetData(profile)).toThrow(/in use/);

  await kill(host);
  expect(() => resetData(profile)).toThrow(/in use/);
  expect(existsSync(join(application, ".stargeist"))).toBe(true);
  expect(readFileSync(join(profile.data, "stargeist.sqlite"), "utf8")).toBe("live database");

  await kill(backend);
  expect(resetData(profile).status).toBe("reset-complete");
  expect(existsSync(join(application, ".stargeist"))).toBe(false);
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
