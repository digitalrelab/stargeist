import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { toolingContext } from "./context";
import { launchDevelopment, type DevelopmentTarget } from "./development";

function fixture(source: string, target: DevelopmentTarget = "desktop") {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "stargeist launch ")));
  const name = target === "desktop" ? "@electron-forge/cli" : "storybook";
  const tool = join(directory, "node_modules", name);

  mkdirSync(tool, { recursive: true });
  writeFileSync(join(directory, "package.json"), "{}");
  writeFileSync(
    join(tool, "package.json"),
    JSON.stringify({
      name,
      bin: target === "desktop" ? { "electron-forge": "launcher.cjs" } : "launcher.cjs",
    }),
  );
  writeFileSync(join(tool, "launcher.cjs"), source);

  onTestFinished(() => rmSync(directory, { recursive: true, force: true }));

  const context = toolingContext();
  context.targets[target].directory = directory;

  return {
    directory,
    run: launchDevelopment(context, target).pipe(Effect.provide(NodeServices.layer)),
  };
}

it.each([
  { target: "desktop" as const, args: ["start"] },
  { target: "ui" as const, args: ["dev", "--host", "localhost", "--port", "6006", "--no-open"] },
])(
  "launches $target in its directory and preserves a failing exit code",
  async ({ target, args }) => {
    const { directory, run } = fixture(
      `
    require("node:fs").writeFileSync("launched.json", JSON.stringify({
      directory: process.cwd(), args: process.argv.slice(2),
    }));
    process.exitCode = 17;
  `,
      target,
    );

    expect(await Effect.runPromise(run)).toBe(17);
    expect(JSON.parse(readFileSync(join(directory, "launched.json"), "utf8"))).toEqual({
      directory,
      args,
    });
  },
);

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
