import { Effect } from "effect";
import { expect, it } from "vite-plus/test";
import { planChecks } from "./plan.ts";
import type { Change, WorkspacePackage } from "./plan.ts";
import { invocations } from "./run.ts";
import { verifyResults } from "./github.ts";

const packages: WorkspacePackage[] = [
  {
    name: "shared",
    directory: "packages/shared",
    platforms: ["linux"],
    tests: true,
    build: false,
  },
  {
    name: "desktop",
    directory: "apps/desktop",
    platforms: ["linux", "darwin", "win32"],
    tests: true,
    build: true,
  },
  {
    name: "website",
    directory: "apps/website",
    platforms: ["linux"],
    tests: true,
    build: true,
  },
  {
    name: "unrelated",
    directory: "packages/unrelated",
    platforms: ["linux"],
    tests: false,
    build: false,
  },
];

function change(...files: string[]): Change {
  return { base: "base", head: "head", workingTree: false, files };
}

it("keeps Linux-only work out of desktop runners", () => {
  const plan = planChecks(packages, new Set(["website"]), change());

  expect(plan.packages.map((pkg) => pkg.name)).toEqual(["website"]);
  expect(plan.excluded).toEqual(["shared", "desktop", "unrelated"]);
  expect(plan.matrix.include).toEqual([
    { platform: "linux", runner: "ubuntu-24.04", desktop: false },
  ]);
  expect(invocations(plan, "linux", "linux").map((command) => command[1])).toEqual([
    "--targets=test",
    "--targets=ci:build",
  ]);
});

it("runs local tests without installers and rejects a mismatched platform", () => {
  const plan = planChecks(packages, new Set(["desktop"]), change());
  const local = invocations(plan, "local", "darwin");

  expect(local.map((command) => command[1])).toEqual([
    "--targets=check,typecheck:tools,typecheck",
    "--targets=test",
  ]);
  expect(local.every((command) => command.includes("--skip-nx-cache"))).toBe(true);
  expect(local.every((command) => command.includes("--no-cloud"))).toBe(true);
  expect(invocations(plan, "darwin", "darwin").map((command) => command[1])).toEqual([
    "--targets=test",
    "--targets=ci:build",
  ]);
  expect(() => invocations(plan, "win32", "darwin")).toThrow("Cannot run job");
});

it.each(["failure", "cancelled", "skipped", undefined])(
  "rejects incomplete platform checks: %s",
  async (result) => {
    const verification = verifyResults(
      JSON.stringify({
        prepare: { result: "success", outputs: { "has-targets": "true" } },
        targets: { result },
      }),
    );

    await expect(Effect.runPromise(verification)).rejects.toThrow(
      /Platform checks must be success|GitHub job results/,
    );
  },
);

it("accepts skipped platform work only when no platform work was planned", async () => {
  await expect(
    Effect.runPromise(
      verifyResults(
        JSON.stringify({
          prepare: { result: "success", outputs: { "has-targets": "false" } },
          targets: { result: "skipped" },
        }),
      ),
    ),
  ).resolves.toBeUndefined();

  await expect(
    Effect.runPromise(
      verifyResults(
        JSON.stringify({
          prepare: { result: "failure" },
          targets: { result: "skipped" },
        }),
      ),
    ),
  ).rejects.toThrow("quality checks");

  await expect(
    Effect.runPromise(
      verifyResults(
        JSON.stringify({
          prepare: { result: "success", outputs: { "has-targets": "false" } },
        }),
      ),
    ),
  ).rejects.toThrow("targets");
});

it("only requests desktop artifacts on platforms that build desktop", () => {
  const projects: WorkspacePackage[] = [
    {
      name: "@stargeist/desktop",
      directory: "apps/desktop",
      platforms: ["darwin"],
      tests: true,
      build: true,
    },
    {
      name: "shared",
      directory: "packages/shared",
      platforms: ["linux", "darwin", "win32"],
      tests: true,
      build: false,
    },
  ];
  const plan = planChecks(projects, new Set(["@stargeist/desktop", "shared"]), change());

  expect(plan.matrix.include).toEqual([
    { platform: "linux", runner: "ubuntu-24.04", desktop: false },
    { platform: "darwin", runner: "macos-15", desktop: true },
    { platform: "win32", runner: "windows-2025", desktop: false },
  ]);
});
