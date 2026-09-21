import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { developmentProfile, initializeProfile } from "./desktop/index";
import { expect, it, onTestFinished } from "vite-plus/test";
import { checkout } from "./context";

const require = createRequire(import.meta.url);
const loader = pathToFileURL(require.resolve("tsx")).href;
const runner = fileURLToPath(new URL("./fixtures/cli-process.ts", import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stargeist cli "));
  const application = join(root, "checkout");
  const appData = join(root, "appData");
  mkdirSync(application);
  mkdirSync(appData);

  onTestFinished(() => rmSync(root, { recursive: true, force: true }));

  return {
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

it("reports a successful reset through the CLI's JSON contract", () => {
  const { profile, run } = fixture();
  initializeProfile(profile);
  mkdirSync(profile.data);
  writeFileSync(join(profile.data, "stargeist.sqlite"), "discard");

  const reset = run("reset", "--yes", "--json");
  expect(reset.status, reset.stderr).toBe(0);
  expect(JSON.parse(reset.stdout)).toMatchObject({
    command: "reset",
    status: "reset-complete",
    exists: false,
    cleanupPending: false,
  });
  expect(existsSync(profile.data)).toBe(false);
});

it("reports ownership failures through the CLI's JSON contract", () => {
  const { profile, run } = fixture();
  initializeProfile(profile);

  writeFileSync(profile.marker, "{}");
  const invalid = run("reset", "--yes", "--json");

  expect(invalid.status, invalid.stderr).toBe(1);
  expect(JSON.parse(invalid.stdout).code).toBe("invalid-owner");
});

it("keeps parsing failures machine-readable without misidentifying the command", () => {
  const { run } = fixture();
  const result = run("unknown", "--json");

  expect(result.status, result.stderr).toBe(1);
  expect(JSON.parse(result.stdout)).toMatchObject({
    command: "sg",
    status: "failed",
    code: "invalid-arguments",
  });
});

it("preserves clean JSON and argument forwarding through the public Bun entrypoint", () => {
  const result = spawnSync("bun", ["run", "--cwd", checkout, "sg", "doctor", "--json"], {
    cwd: join(checkout, "packages", "domain"),
    encoding: "utf8",
    timeout: 20000,
  });

  const report = JSON.parse(result.stdout);
  expect(report).toMatchObject({ command: "doctor", checkout });
  expect(result.status).toBe(report.status === "failed" ? 1 : 0);
});
