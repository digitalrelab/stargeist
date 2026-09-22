import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { developmentProfile, initializeProfile } from "./desktop/index";
import { expect, it, onTestFinished } from "vite-plus/test";
import { checkout } from "./context";
import { rememberWorkspaces } from "./workspaces.test-support";

const require = createRequire(import.meta.url);
const loader = pathToFileURL(require.resolve("tsx")).href;
const runner = fileURLToPath(new URL("./fixtures/cli-process.ts", import.meta.url));

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "stargeist cli ")));
  const application = join(root, "checkout");
  const appData = join(root, "appData");
  mkdirSync(application);
  mkdirSync(appData);

  onTestFinished(() => rmSync(root, { recursive: true, force: true }));

  return {
    root,
    profile: developmentProfile(application, appData),
    run: (...args: string[]) =>
      spawnSync(process.execPath, ["--import", loader, runner, application, appData, ...args], {
        cwd: application,
        encoding: "utf8",
        timeout: 15000,
      }),
  };
}

it("keeps doctor read-only", () => {
  const { profile, run } = fixture();
  const doctor = run("doctor", "--json");

  expect(doctor.error).toBeUndefined();
  expect(JSON.parse(doctor.stdout), doctor.stderr).toMatchObject({ command: "doctor" });
  expect(existsSync(profile.base)).toBe(false);
});

it("keeps reset previews read-only", () => {
  const { profile, run } = fixture();

  const preview = run("reset", "--dry-run", "--json");

  expect(preview.status, preview.stderr).toBe(0);
  expect(JSON.parse(preview.stdout)).toMatchObject({
    status: "preview",
    exists: false,
  });
  expect(existsSync(profile.base)).toBe(false);
});

it("requires noninteractive reset confirmation", () => {
  const { profile, run } = fixture();
  const unconfirmed = run("reset", "--json");

  expect(unconfirmed.status, unconfirmed.stderr).toBe(2);
  expect(JSON.parse(unconfirmed.stdout).code).toBe("confirmation-required");
  expect(existsSync(profile.base)).toBe(false);
});

it("previews known workspaces in text and JSON, then reports their reset", async () => {
  const { root, profile, run } = fixture();
  initializeProfile(profile);
  const workspace = join(root, "workspace with spaces");
  const metadata = join(workspace, ".stargeist");
  mkdirSync(metadata, { recursive: true });
  writeFileSync(join(metadata, "workspace.json"), "obsolete");
  writeFileSync(join(workspace, "file.txt"), "keep");
  await rememberWorkspaces(profile, [workspace]);
  const before = readFileSync(join(profile.data, "application.sqlite"));

  const preview = run("reset", "--dry-run", "--json");
  expect(preview.status, preview.stderr).toBe(0);
  expect(JSON.parse(preview.stdout)).toMatchObject({
    status: "preview",
    workspaces: [{ root: workspace, path: metadata, status: "ready" }],
  });
  const text = run("reset", "--dry-run");
  expect(text.status, text.stderr).toBe(0);
  expect(text.stdout).toContain(metadata);
  expect(text.stdout).toContain(profile.data);
  expect(run("reset", "--json").status).toBe(2);
  expect(readFileSync(join(profile.data, "application.sqlite"))).toEqual(before);
  expect(existsSync(metadata)).toBe(true);

  const reset = run("reset", "--yes", "--json");
  expect(reset.status, reset.stderr).toBe(0);
  expect(JSON.parse(reset.stdout)).toMatchObject({
    command: "reset",
    status: "reset-complete",
    exists: false,
    cleanupPending: false,
    workspaces: [{ root: workspace, path: metadata, status: "removed" }],
  });
  expect(existsSync(profile.data)).toBe(false);
  expect(existsSync(metadata)).toBe(false);
  expect(readFileSync(join(workspace, "file.txt"), "utf8")).toBe("keep");
}, 30000);

it("reports partial resets as failures and retains the paths needed to retry", async () => {
  const { root, profile, run } = fixture();
  initializeProfile(profile);
  const workspace = join(root, "workspace");
  const outside = join(root, "outside");
  mkdirSync(workspace);
  mkdirSync(outside);
  let linkType: "dir" | "junction" = "dir";
  if (process.platform === "win32") {
    linkType = "junction";
  }
  symlinkSync(outside, join(workspace, ".stargeist"), linkType);
  await rememberWorkspaces(profile, [workspace]);
  const result = run("reset", "--yes", "--json");
  expect(result.status, result.stderr).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    command: "reset",
    status: "reset-incomplete",
    exists: true,
    workspaces: [{ root: workspace, status: "blocked" }],
  });
  expect(existsSync(join(profile.data, "application.sqlite"))).toBe(true);
  expect(existsSync(outside)).toBe(true);
});

it("reports ownership failures through the CLI's JSON contract", () => {
  const { profile, run } = fixture();
  initializeProfile(profile);

  writeFileSync(profile.marker, "{}");
  const invalid = run("reset", "--yes", "--json");

  expect(invalid.status, invalid.stderr).toBe(1);
  expect(JSON.parse(invalid.stdout).code).toBe("invalid-owner");
});

it.each(["--json", "--json=true"])("keeps parsing failures machine-readable with %s", (flag) => {
  const { run } = fixture();
  const result = run("unknown", flag);

  expect(result.status, result.stderr).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    command: "sg",
    status: "failed",
    code: "invalid-arguments",
  });
});

it.each([".", "apps/sg-desktop"])("runs desktop diagnostics from %s with Node", (directory) => {
  const { profile } = fixture();
  const result = spawnSync("bun", ["run", "sg", "doctor", "--json"], {
    cwd: join(checkout, directory),
    env: { ...process.env, APPDATA: profile.base, XDG_CONFIG_HOME: profile.base },
    encoding: "utf8",
    timeout: 20000,
  });

  expect(result.error).toBeUndefined();

  const report = JSON.parse(result.stdout);
  expect(report, result.stderr).toMatchObject({ command: "doctor", checkout, target: "desktop" });
  expect(report.checks).toContainEqual(
    expect.objectContaining({
      name: "node",
      message: expect.stringContaining(`${process.versions.node} (required `),
    }),
  );
  expect(result.status).toBe(report.status === "failed" ? 1 : 0);
});

it("refuses JSON development sessions before launching a tool", () => {
  const { run } = fixture();
  const result = run("dev", "--json=true");

  expect(result.status).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    status: "failed",
    message: "Development streams tool output. Use doctor --json for diagnostics.",
  });
});

it("honors an explicit false JSON value when reporting errors", () => {
  const { run } = fixture();
  const result = run("unknown", "--json", "false");

  expect(result.status).toBe(1);
  expect(result.stdout).toContain("Invalid command.");
  expect(result.stdout).not.toContain('"status":"failed"');
});
