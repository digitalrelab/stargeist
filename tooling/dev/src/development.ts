import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { ChildProcess } from "effect/unstable/process";
import type { ToolingContext } from "./context";

export type DevelopmentTarget = "desktop" | "web";

export function developmentTool(context: ToolingContext, target: DevelopmentTarget) {
  const directory = context.targets[target].directory;
  const name = target === "desktop" ? "@electron-forge/cli" : "portless";
  const binary = target === "desktop" ? "electron-forge" : "portless";
  const from =
    target === "desktop" ? pathToFileURL(join(directory, "package.json")) : import.meta.url;

  try {
    const manifestPath = findPackageJSON(name, from);

    if (!manifestPath) {
      throw new Error(`Cannot resolve ${name}.`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin: Record<string, string>;
    };
    const entry = manifest.bin[binary];

    if (!entry) {
      throw new Error(`Missing ${binary} executable.`);
    }

    return { name, entry: join(dirname(manifestPath), entry) };
  } catch (cause) {
    throw new Error(`${name} is unavailable; run bun install.`, { cause });
  }
}

export function launchDevelopment(context: ToolingContext, target: DevelopmentTarget) {
  return Effect.gen(function* () {
    const tool = yield* Effect.try(() => developmentTool(context, target));
    const args = target === "desktop" ? ["start"] : [context.targets.web.name, "vp", "dev"];

    const child = yield* ChildProcess.make(process.execPath, [tool.entry, ...args], {
      cwd: context.targets[target].directory,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      killSignal: "SIGINT",
      forceKillAfter: "10 seconds",
    });

    return yield* child.exitCode;
  }).pipe(Effect.scoped);
}
