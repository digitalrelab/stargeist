import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import { ChildProcess } from "effect/unstable/process";
import type { ToolingContext } from "./context";

export function developmentTool(context: ToolingContext) {
  const directory = context.desktop.directory;
  const name = "@electron-forge/cli";
  const binary = "electron-forge";
  const from = pathToFileURL(join(directory, "package.json"));

  try {
    const manifestPath = findPackageJSON(name, from);

    if (!manifestPath) {
      throw new Error(`Cannot resolve ${name}.`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      bin: string | Record<string, string>;
    };
    const entry = typeof manifest.bin === "string" ? manifest.bin : manifest.bin[binary];

    if (!entry) {
      throw new Error(`Missing ${binary} executable.`);
    }

    return { name, entry: join(dirname(manifestPath), entry) };
  } catch (cause) {
    throw new Error(`${name} is unavailable; run bun install.`, { cause });
  }
}

export function launchDevelopment(context: ToolingContext) {
  return Effect.gen(function* () {
    const tool = yield* Effect.try(() => developmentTool(context));
    const child = yield* ChildProcess.make(process.execPath, [tool.entry, "start"], {
      cwd: context.desktop.directory,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      killSignal: "SIGINT",
      forceKillAfter: "10 seconds",
    });

    return yield* child.exitCode;
  }).pipe(Effect.scoped);
}
