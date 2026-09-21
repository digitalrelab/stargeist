import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { toolingContext } from "./context";
import { launchDevelopment } from "./development";

function fixture(source: string) {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "stargeist launch ")));
  const tool = join(directory, "node_modules", "@electron-forge", "cli");

  mkdirSync(tool, { recursive: true });
  writeFileSync(join(directory, "package.json"), "{}");
  writeFileSync(
    join(tool, "package.json"),
    JSON.stringify({ name: "@electron-forge/cli", bin: { "electron-forge": "launcher.cjs" } }),
  );
  writeFileSync(join(tool, "launcher.cjs"), source);

  onTestFinished(() => rmSync(directory, { recursive: true, force: true }));

  const context = toolingContext();
  context.targets.desktop.directory = directory;

  return {
    directory,
    run: launchDevelopment(context, "desktop").pipe(Effect.provide(NodeServices.layer)),
  };
}

it("launches the installed tool in the target directory and preserves a failing exit code", async () => {
  const { directory, run } = fixture(`
    require("node:fs").writeFileSync("launched.json", JSON.stringify({
      directory: process.cwd(), args: process.argv.slice(2),
    }));
    process.exitCode = 17;
  `);

  expect(await Effect.runPromise(run)).toBe(17);
  expect(JSON.parse(readFileSync(join(directory, "launched.json"), "utf8"))).toEqual({
    directory,
    args: ["start"],
  });
});

it("terminates the launched process and its descendant when the session is interrupted", async () => {
  const { directory, run } = fixture(`
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", "process.send(process.pid); setInterval(() => {}, 1000)"], {
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    child.on("message", (pid) => {
      require("node:fs").writeFileSync("ready.json", JSON.stringify([process.pid, pid]));
    });
    setInterval(() => {}, 1000);
  `);
  const fiber = Effect.runFork(run);

  onTestFinished(() => Effect.runPromise(Fiber.interrupt(fiber)));

  const ready = join(directory, "ready.json");
  await expect.poll(() => JSON.parse(readFileSync(ready, "utf8"))).toHaveLength(2);

  const pids: number[] = JSON.parse(readFileSync(ready, "utf8"));
  await Effect.runPromise(Fiber.interrupt(fiber));

  for (const pid of pids) {
    await expect
      .poll(() => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      })
      .toBe(false);
  }
});
