import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console as NodeConsole } from "node:console";
import { parseArgs } from "node:util";
import { ProfileError } from "./desktop/index";
import { Cause, Console, Effect } from "effect";
import {
  Argument,
  CliConfig,
  CliError,
  Command,
  Flag,
  GlobalFlag,
  Prompt,
  Primitive,
} from "effect/unstable/cli";
import { toolingContext, type ToolingContext } from "./context";
import { diagnose } from "./doctor";
import { launchDevelopment } from "./development";
import { previewReset, resetData } from "./reset";

function jsonRequested(args: string[]) {
  const { tokens } = parseArgs({
    args,
    options: { json: { type: "boolean" } },
    allowNegative: true,
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  const flag = tokens.findLast((token) => token.kind === "option" && token.name === "json");

  if (!flag || flag.kind !== "option" || flag.rawName === "--no-json") {
    return Effect.succeed(false);
  }

  return Primitive.Boolean.parse(flag.value ?? args[flag.index + 1] ?? "").pipe(
    Effect.catch(() => Effect.succeed(flag.value === undefined)),
  );
}

function output(report: object, json: boolean, message: string) {
  process.stdout.write(json ? `${JSON.stringify(report)}\n` : `${message}\n`);
}

export function runCli(args: string[], createContext: () => ToolingContext = toolingContext) {
  return Effect.gen(function* () {
    const jsonOutput = yield* jsonRequested(args);
    const diagnostics = new NodeConsole({
      stdout: jsonOutput ? process.stderr : process.stdout,
      stderr: process.stderr,
    });

    const root = Command.make("sg").pipe(
      Command.withDescription("Develop and maintain this Stargeist checkout."),
      Command.withSharedFlags({
        json: Flag.Boolean("json").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Write a structured result without interactive prompts."),
        ),
      }),
    );

    const target = Argument.Literals("target", ["desktop", "ui"]).pipe(
      Argument.withDefault("desktop"),
    );

    const dev = Command.make("dev", { target }, ({ target }) =>
      Effect.gen(function* () {
        const { json } = yield* root;

        if (json) {
          return yield* Effect.fail(
            new Error("Development streams tool output. Use doctor --json for diagnostics."),
          );
        }

        const context = yield* Effect.try(createContext);
        const report = yield* Effect.try(() => diagnose(context, target));
        const failures = report.checks.filter((check) => check.status === "error");

        if (failures.length > 0) {
          return yield* Effect.fail(
            new Error(failures.map((check) => `${check.name}: ${check.message}`).join("\n")),
          );
        }

        process.stdout.write(`Starting ${target} in ${report.directory}\n`);
        process.exitCode = yield* launchDevelopment(context, target);
      }),
    ).pipe(Command.withDescription("Start this checkout's desktop or UI development session."));

    const doctor = Command.make("doctor", { target }, ({ target }) =>
      Effect.gen(function* () {
        const { json } = yield* root;
        const report = yield* Effect.try(() => diagnose(createContext(), target));

        output(
          report,
          json,
          [
            `Checkout: ${report.checkout}`,
            `Target: ${report.target}`,
            `Directory: ${report.directory}`,
            ...("profile" in report ? [`Profile: ${report.profile}`] : []),
            ...report.checks.map(
              (check) => `${check.status.toUpperCase()} ${check.name}: ${check.message}`,
            ),
          ].join("\n"),
        );

        if (report.status === "failed") {
          process.exitCode = 1;
        }
      }),
    ).pipe(Command.withDescription("Inspect the development environment without modifying it."));

    const reset = Command.make(
      "reset",
      {
        dryRun: Flag.Boolean("dry-run").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Preview application-data reset without changing files."),
        ),
        yes: Flag.Boolean("yes").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Confirm data deletion; all safety checks still apply."),
        ),
      },
      ({ dryRun, yes }) =>
        Effect.gen(function* () {
          const { json } = yield* root;
          const profile = yield* Effect.try(() => createContext().desktopProfile());
          const preview = yield* Effect.try(() => previewReset(profile));

          if (dryRun) {
            output(
              preview,
              json,
              `Profile: ${preview.profile}\nReset target: ${preview.target}\nAccess: ${preview.access}\n${preview.exists ? "Application data would be deleted." : "Application data is already empty."}`,
            );

            return;
          }

          if (!yes) {
            if (json || !process.stdin.isTTY || !process.stdout.isTTY) {
              output(
                {
                  command: "reset",
                  status: "failed",
                  code: "confirmation-required",
                  message: "Review reset --dry-run, then pass --yes to reset noninteractively.",
                },
                json,
                "Review reset --dry-run, then pass --yes to reset noninteractively.",
              );

              process.exitCode = 2;
              return;
            }

            const confirmed = yield* Prompt.run(
              Prompt.Confirm({
                message: `Delete development application data at ${profile.data}?`,
                initial: false,
              }),
            ).pipe(Effect.catchTag("QuitError", () => Effect.succeed(false)));

            if (!confirmed) {
              output({ command: "reset", status: "cancelled" }, json, "Reset cancelled.");

              process.exitCode = 130;
              return;
            }
          }

          const report = yield* Effect.try(() => resetData(profile));

          output(
            report,
            json,
            report.status === "already-empty"
              ? "Application data is already empty."
              : report.status === "cleanup-pending"
                ? `Application data reset. Cleanup remains at ${report.quarantine}: ${report.message}`
                : "Development application data reset. The next launch recreates the database.",
          );

          if (report.status === "cleanup-pending") {
            process.exitCode = 1;
          }
        }),
    ).pipe(
      Command.withDescription(
        "Reset this checkout's application data, preserving source folders and browser state.",
      ),
    );

    const command = root.pipe(Command.withSubcommands([dev, doctor, reset]));

    return yield* Command.runWith(command, { version: "0.0.0", renderErrors: !jsonOutput })(
      args,
    ).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          const original = Cause.isUnknownError(error) ? error.cause : error;

          const code =
            original instanceof ProfileError
              ? original.code
              : CliError.isCliError(error)
                ? "invalid-arguments"
                : "operation-failed";
          const message = CliError.isCliError(error)
            ? "Invalid command. Run bun run sg --help."
            : original instanceof Error
              ? original.message
              : String(original);

          output({ command: "sg", status: "failed", code, message }, jsonOutput, message);

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
      Effect.provideService(Console.Console, diagnostics),
      Effect.provide(
        CliConfig.layer({
          builtIns: [GlobalFlag.Help, GlobalFlag.Version, GlobalFlag.Completions],
        }),
      ),
    );
  }).pipe(Effect.provide(NodeServices.layer));
}
