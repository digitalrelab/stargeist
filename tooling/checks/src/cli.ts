import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeStream from "@effect/platform-node/NodeStream";
import { Cause, Config, Console, Effect, FileSystem, Schema, Stream } from "effect";
import { CliConfig, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { ChecksError, decode, Platform, PushUpdate } from "./input.ts";
import { checkCheckout, git, rootAt } from "./git.ts";
import { readWorkspace } from "./nx.ts";
import { invocations, runChecks } from "./run.ts";
import type { Job } from "./run.ts";

const revisionFlags = {
  base: Flag.String("base").pipe(
    Flag.withFallbackConfig(Config.String("CHECKS_BASE").pipe(Config.withDefault(""))),
  ),
  committed: Flag.Boolean("committed").pipe(Flag.withDefault(false)),
};

const execute = Effect.fn("checks.execute")(function* (
  root: string,
  base: string,
  job: Job,
  head?: string,
) {
  if (head) {
    yield* checkCheckout(root, head);
  }

  const plan = yield* readWorkspace(root, base, head !== undefined);
  const platform = yield* decode(Platform, process.platform, "Current platform");

  yield* Console.error(JSON.stringify(plan, null, 2));
  yield* runChecks(root, invocations(plan, job, platform));

  if (head) {
    yield* checkCheckout(root, head);
  }
});

const prePush = Effect.fn("checks.prePush")(function* () {
  const root = yield* rootAt(process.cwd());
  const input = yield* NodeStream.fromReadable({ evaluate: () => process.stdin }).pipe(
    Stream.decodeText(),
    Stream.mkString,
  );
  const updates: Array<{ head: string; remote: string }> = [];

  for (const line of input.trim().split("\n").filter(Boolean)) {
    const [, head, , remote] = yield* decode(
      PushUpdate,
      line.trim().split(/\s+/),
      "Git push update",
    );

    if (!/^0+$/.test(head)) {
      updates.push({ head, remote });
    }
  }

  if (updates.length === 0) {
    return;
  }

  const head = yield* git(root, "rev-parse", "HEAD");

  if (updates.some((update) => update.head !== head)) {
    return yield* new ChecksError({
      message: "Push the checked-out commit separately so its checks can be verified",
    });
  }

  let base = "";

  if (updates.length === 1 && !/^0+$/.test(updates[0]!.remote)) {
    base = updates[0]!.remote;
  }

  yield* execute(root, base, "local", head);
});

const plan = Command.make(
  "plan",
  { ...revisionFlags, github: Flag.Boolean("github").pipe(Flag.withDefault(false)) },
  Effect.fn("checks.planCommand")(function* (options) {
    const root = yield* rootAt(process.cwd());

    if (options.committed) {
      yield* checkCheckout(root);
    }

    const result = yield* readWorkspace(root, options.base, options.committed);
    const json = JSON.stringify(result, null, 2);

    if (options.github) {
      const fs = yield* FileSystem.FileSystem;
      const output = yield* decode(
        Schema.NonEmptyString,
        process.env.GITHUB_OUTPUT,
        "GITHUB_OUTPUT",
      );

      yield* fs.writeFileString(
        output,
        [
          `matrix=${JSON.stringify(result.matrix)}`,
          `has-targets=${result.matrix.include.length > 0}`,
          "",
        ].join("\n"),
        { flag: "a" },
      );

      if (process.env.GITHUB_STEP_SUMMARY) {
        yield* fs.writeFileString(
          process.env.GITHUB_STEP_SUMMARY,
          `## Check plan\n\n\`\`\`json\n${json}\n\`\`\`\n`,
          { flag: "a" },
        );
      }
    }

    yield* Console.log(json);
  }),
);

const run = Command.make(
  "run",
  {
    ...revisionFlags,
    job: Flag.Literals("job", ["quality", "local", "platform"]).pipe(Flag.withDefault("local")),
  },
  Effect.fn("checks.runCommand")(function* (options) {
    const root = yield* rootAt(process.cwd());
    let head: string | undefined;

    if (options.committed) {
      head = yield* git(root, "rev-parse", "HEAD");
    }

    yield* execute(root, options.base, options.job, head);
  }),
);

const command = Command.make("stargeist-checks").pipe(
  Command.withSubcommands([plan, run, Command.make("pre-push", {}, prePush)]),
);

export function runCli(args: string[]) {
  return Command.runWith(command, { version: "0.0.0", renderErrors: false })(args).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Console.error(error.message);
        process.exitCode = 1;
      }),
    ),
    Effect.onExit((exit) =>
      Effect.sync(() => {
        if (exit._tag === "Failure" && Cause.hasInterruptsOnly(exit.cause)) {
          process.exitCode = 130;
        }
      }),
    ),
    Effect.provide(CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] })),
    Effect.provide(NodeServices.layer),
  );
}
