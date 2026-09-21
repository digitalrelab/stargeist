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
      runChecks(repo.root, [
        ["run", "stargeist:check", "--skip-nx-cache", "--no-cloud", "--outputStyle=static"],
      ]),
    );
    const pid = yield* Effect.promise(() => ready).pipe(Effect.timeout("10 seconds"));

    yield* Fiber.interrupt(fiber);

    expect(() => process.kill(pid, 0)).toThrow();
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer));

  await Effect.runPromise(program);
}, 15000);

it("executes tasks again with caching disabled and honors prerequisite ordering", () => {
  const repo = fixture();

  repo.write("packages/shared/package.json", {
    name: "shared",
    scripts: { typecheck: "node task.cjs" },
    nx: { tags: ["platform:linux"] },
  });
  repo.write(
    "packages/shared/task.cjs",
    "require('node:fs').appendFileSync('../../.cache/executions', 'shared\\n');",
  );
  repo.write("apps/website/package.json", {
    name: "website",
    dependencies: { shared: "workspace:*" },
    scripts: { typecheck: "node task.cjs" },
    nx: {
      tags: ["platform:linux"],
      targets: { typecheck: { dependsOn: ["^typecheck"] } },
    },
  });
  repo.write(
    "apps/website/task.cjs",
    "require('node:fs').appendFileSync('../../.cache/executions', 'website\\n');",
  );
  repo.write(".cache/executions", "");

  for (let iteration = 0; iteration < 2; iteration++) {
    const result = repo.nx("run", "website:typecheck", "--no-cloud", "--outputStyle=static");

    expect(result.status, result.stdout + result.stderr).toBe(0);
  }

  expect(readFileSync(join(repo.root, ".cache/executions"), "utf8")).toBe(
    "shared\nwebsite\nshared\nwebsite\n",
  );
}, 15000);
