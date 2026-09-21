import * as NodeServices from "@effect/platform-node/NodeServices";
import * as NodeStream from "@effect/platform-node/NodeStream";
import { Cause, Console, Effect, Option, Schema, Stream } from "effect";
import { CliConfig, Command, Flag, GlobalFlag } from "effect/unstable/cli";
import { planChecks } from "./plan.ts";
import { attempt, ChecksError, decode, PlanReference, Platform, PushUpdate } from "./input.ts";
import { changes, checkCheckout, git, rootAt } from "./git.ts";
import { readWorkspace } from "./nx.ts";
import { invocations, runChecks } from "./run.ts";
import { publishPlan, referenceFor, verifyResults } from "./github.ts";

const revisionFlags = {
  base: Flag.String("base").pipe(Flag.withSchema(Schema.NonEmptyString), Flag.optional),
  head: Flag.String("head").pipe(Flag.withSchema(Schema.NonEmptyString), Flag.optional),
  committed: Flag.Boolean("committed").pipe(Flag.withDefault(false)),
};

const createPlan = Effect.fn("checks.createPlan")(function* (
  root: string,
  base: string | undefined,
  head: string | undefined,
  committed: boolean,
) {
  const change = yield* changes(root, base, head, !committed);
  const { packages, selected } = yield* readWorkspace(root, change);

  return planChecks(packages, selected, change);
});

const restorePlan = Effect.fn("checks.restorePlan")(function* (root: string, source: string) {
  const saved = yield* decode(Schema.fromJsonString(PlanReference), source, "Plan reference");
  const current = yield* createPlan(root, saved.base ?? undefined, saved.head, !saved.workingTree);

  if (JSON.stringify(saved) !== JSON.stringify(referenceFor(current))) {
    return yield* new ChecksError({ message: "Plan does not match this checkout; regenerate it" });
  }

  return current;
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

  let base: string | undefined;

  if (updates.length === 1 && !/^0+$/.test(updates[0]!.remote)) {
    base = updates[0]!.remote;
  }

  const plan = yield* createPlan(root, base, head, true);
  const platform = yield* decode(Platform, process.platform, "Current platform");
  const commands = yield* attempt(() => invocations(plan, "local", platform));

  yield* Console.error(JSON.stringify(plan, null, 2));
  yield* runChecks(root, commands);
  yield* checkCheckout(root, head);
});

const plan = Command.make(
  "plan",
  {
    ...revisionFlags,
    github: Flag.Boolean("github").pipe(Flag.withDefault(false)),
  },
  Effect.fn("checks.planCommand")(function* (options) {
    const root = yield* rootAt(process.cwd());
    const result = yield* createPlan(
      root,
      Option.getOrUndefined(options.base),
      Option.getOrUndefined(options.head),
      options.committed,
    );

    if (options.github) {
      const output = yield* decode(
        Schema.NonEmptyString,
        process.env.GITHUB_OUTPUT,
        "GITHUB_OUTPUT",
      );

      yield* publishPlan(result, output, process.env.GITHUB_STEP_SUMMARY);
    }

    yield* Console.log(JSON.stringify(result, null, 2));
  }),
);

const run = Command.make(
  "run",
  {
    ...revisionFlags,
    job: Flag.Literals("job", ["quality", "local", "linux", "darwin", "win32"]).pipe(
      Flag.withDefault("local"),
    ),
  },
  Effect.fn("checks.runCommand")(function* (options) {
    const root = yield* rootAt(process.cwd());
    const reference = process.env.CHECKS_PLAN;

    if (
      reference &&
      (Option.isSome(options.base) || Option.isSome(options.head) || options.committed)
    ) {
      return yield* new ChecksError({
        message: "CHECKS_PLAN cannot be combined with revision options",
      });
    }

    let selected;

    if (reference) {
      selected = yield* restorePlan(root, reference);
    } else {
      selected = yield* createPlan(
        root,
        Option.getOrUndefined(options.base),
        Option.getOrUndefined(options.head),
        options.committed,
      );
    }

    const platform = yield* decode(Platform, process.platform, "Current platform");
    const commands = yield* attempt(() => invocations(selected, options.job, platform));

    yield* Console.error(JSON.stringify(selected, null, 2));
    yield* runChecks(root, commands);

    if (!selected.change.workingTree) {
      yield* checkCheckout(root, selected.change.head);
    }
  }),
);

const verify = Command.make(
  "verify",
  {},
  Effect.fn("checks.verifyCommand")(function* () {
    yield* verifyResults(process.env.CHECKS_RESULTS);
    yield* Console.log("All required checks succeeded.");
  }),
);

const command = Command.make("stargeist-checks").pipe(
  Command.withSubcommands([plan, run, verify, Command.make("pre-push", {}, prePush)]),
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
