import { Console, Effect } from "effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { ChecksError } from "./input.ts";
import type { Plan, Platform } from "./plan.ts";
import { nxCommand, nxEnvironment } from "./nx.ts";

export function invocations(plan: Plan, job: string, platform: Platform): string[][] {
  const commands: string[][] = [];

  function tasks(targets: string[], names: string[]) {
    if (names.length === 0) {
      return;
    }

    commands.push([
      "run-many",
      `--targets=${targets.join(",")}`,
      `--projects=${names.join(",")}`,
      "--skip-nx-cache",
      "--no-cloud",
      "--outputStyle=static",
    ]);
  }

  if (job === "quality" || job === "local") {
    tasks(
      ["check", "typecheck:tools", "typecheck"],
      ["stargeist", ...plan.packages.map((pkg) => pkg.name)],
    );
  }

  if (job === "quality") {
    return commands;
  }

  if (job !== "local" && job !== platform) {
    throw new Error(`Cannot run job ${job} on ${platform}`);
  }

  const packages = plan.packages.filter((pkg) => pkg.platforms.includes(platform));

  tasks(
    ["test"],
    packages.filter((pkg) => pkg.tests).map((pkg) => pkg.name),
  );

  if (job !== "local") {
    tasks(
      ["ci:build"],
      packages.filter((pkg) => pkg.build).map((pkg) => pkg.name),
    );
  }

  return commands;
}

export const runChecks = Effect.fn("checks.runChecks")(function* (
  root: string,
  commands: string[][],
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const environment = yield* nxEnvironment(root);

  for (const args of commands) {
    yield* Console.error(`\nchecks: nx ${args.join(" ")}`);

    const exitCode = yield* spawner.exitCode(
      nxCommand(root, args, environment, { stdout: "inherit" }),
    );

    if (exitCode !== 0) {
      return yield* new ChecksError({
        message: `Check failed: nx ${args.join(" ")} (exit ${exitCode})`,
      });
    }
  }
});
