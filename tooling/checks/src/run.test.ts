import * as NodeServices from "@effect/platform-node/NodeServices";
import { existsSync, readFileSync, watch } from "node:fs";
import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { runChecks } from "./run.ts";
import { fixture } from "./fixture.test-support.ts";

it("terminates Nx and its running task when interrupted", async () => {
  const repo = fixture();
  const readyPath = join(repo.root, "ready");

  repo.write(
    "check.cjs",
    [
      "require('node:fs').writeFileSync('ready', String(process.pid));",
      "setInterval(() => {}, 1000);",
    ].join("\n"),
  );

  const ready = new Promise<number>((resolve) => {
    const watcher = watch(repo.root, () => {
      if (!existsSync(readyPath)) {
        return;
      }

      const pid = Number(readFileSync(readyPath, "utf8"));

      if (pid > 0) {
        watcher.close();
        resolve(pid);
      }
    });

    onTestFinished(() => watcher.close());
  });

  const program = Effect.gen(function* () {
    const fiber = yield* Effect.forkScoped(
      runChecks(repo.root, [["run", "stargeist:check", "--outputStyle=static"]]),
    );
    const pid = yield* Effect.promise(() => ready).pipe(Effect.timeout("10 seconds"));

    yield* Fiber.interrupt(fiber);

    expect(() => process.kill(pid, 0)).toThrow();
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

  await Effect.runPromise(program);
}, 15000);
