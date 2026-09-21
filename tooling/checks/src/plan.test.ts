import { expect, it } from "vite-plus/test";
import { planChecks } from "./plan.ts";
import type { WorkspacePackage } from "./plan.ts";
import { invocations } from "./run.ts";

const packages: WorkspacePackage[] = [
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

it("only schedules selected work and requests artifacts where desktop builds", () => {
  const desktop = planChecks(packages, new Set(["@stargeist/desktop"]));

  expect(desktop.excluded).toEqual(["shared"]);
  expect(desktop.matrix.include).toEqual([
    { platform: "darwin", runner: "macos-15", desktop: true },
  ]);

  const all = planChecks(packages, new Set(["@stargeist/desktop", "shared"]));

  expect(all.matrix.include).toEqual([
    { platform: "linux", runner: "ubuntu-24.04", desktop: false },
    { platform: "darwin", runner: "macos-15", desktop: true },
    { platform: "win32", runner: "windows-2025", desktop: false },
  ]);
  expect(planChecks(packages, new Set()).matrix.include).toEqual([]);
});

it("keeps installers out of local checks and limits platform jobs to supported projects", () => {
  const plan = planChecks(packages, new Set(["@stargeist/desktop", "shared"]));
  const local = invocations(plan, "local", "darwin");

  expect(local.map((command) => command[1])).toEqual([
    "--targets=check,typecheck:tools,typecheck",
    "--targets=test",
  ]);
  expect(invocations(plan, "quality", "linux")).toHaveLength(1);
  expect(invocations(plan, "platform", "linux")).toEqual([
    ["run-many", "--targets=test", "--projects=shared", "--outputStyle=static"],
  ]);
  expect(invocations(plan, "platform", "darwin").map((command) => command[1])).toEqual([
    "--targets=test",
    "--targets=ci:build",
  ]);
});
