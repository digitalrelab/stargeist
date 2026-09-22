import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console as NodeConsole } from "node:console";
import { parseArgs } from "node:util";
import { ProfileError } from "./desktop/index";
import { Cause, Console, Effect } from "effect";
import {
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
  if (json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  process.stdout.write(`${message}\n`);
}

function workspaceTargets(report: ReturnType<typeof previewReset> | ReturnType<typeof resetData>) {
  if (report.workspaces.length === 0) {
    return ["No known workspaces."];
  }
  return report.workspaces.map((target) => {
    if (target.status === "blocked") {
      return `Blocked: ${target.path}\n  ${target.message}`;
    }
    if (target.status === "missing") {
      return `Missing: ${target.path}`;
    }
    return `Reset: ${target.path}`;
  });
}

function resetPreviewMessage(preview: ReturnType<typeof previewReset>) {
  const lines = [`App data: ${preview.target}`, ...workspaceTargets(preview)];
  if (preview.cleanupPending) {
    lines.push(`Remaining data: ${preview.quarantine}`);
  }
  if (preview.access === "busy") {
    lines.push("Close the app before resetting.");
  }
  lines.push(
    "App settings and workspace data will be deleted. Your files are kept.",
    "Only known workspaces are included.",
  );
  return lines.join("\n");
}

function resetResultMessage(report: ReturnType<typeof resetData>) {
  let message;
  switch (report.status) {
    case "already-empty":
      message = "Nothing to reset.";
      break;
    case "reset-complete":
      message = "Reset complete.";
      break;
    case "reset-incomplete":
      message = "Reset incomplete. App data was kept. Fix the errors below and retry.";
      break;
    case "cleanup-pending":
      message = `Some data could not be removed. Retry reset.\n${report.quarantine}: ${report.message}`;
      break;
  }
  return [message, ...workspaceTargets(report)].join("\n");
}

export function runCli(args: string[], createContext: () => ToolingContext = toolingContext) {
  return Effect.gen(function* () {
    const jsonOutput = yield* jsonRequested(args);
    let diagnosticOutput: NodeJS.WriteStream = process.stdout;
    if (jsonOutput) {
      diagnosticOutput = process.stderr;
    }
    const diagnostics = new NodeConsole({
      stdout: diagnosticOutput,
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

    const dev = Command.make("dev", {}, () =>
      Effect.gen(function* () {
        const { json } = yield* root;

        if (json) {
          return yield* Effect.fail(
            new Error("Development streams tool output. Use doctor --json for diagnostics."),
          );
        }

        const context = yield* Effect.try(createContext);
        const report = yield* Effect.try(() => diagnose(context));
        const failures = report.checks.filter((check) => check.status === "error");

        if (failures.length > 0) {
          return yield* Effect.fail(
            new Error(failures.map((check) => `${check.name}: ${check.message}`).join("\n")),
          );
        }

        process.stdout.write(`Starting desktop in ${report.directory}\n`);
        process.exitCode = yield* launchDevelopment(context);
      }),
    ).pipe(Command.withDescription("Start this checkout's desktop development session."));

    const doctor = Command.make("doctor", {}, () =>
      Effect.gen(function* () {
        const { json } = yield* root;
        const report = yield* Effect.try(() => diagnose(createContext()));

        output(
          report,
          json,
          [
            `Checkout: ${report.checkout}`,
            `Target: ${report.target}`,
            `Directory: ${report.directory}`,
            `Profile: ${report.profile}`,
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
          Flag.withDescription("Preview what will be reset."),
        ),
        yes: Flag.Boolean("yes").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Confirm reset."),
        ),
      },
      ({ dryRun, yes }) =>
        Effect.gen(function* () {
          const { json } = yield* root;
          const profile = yield* Effect.try(() => createContext().desktopProfile());
          const preview = yield* Effect.try(() => previewReset(profile));

          if (dryRun) {
            output(preview, json, resetPreviewMessage(preview));

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

            process.stdout.write(`${resetPreviewMessage(preview)}\n`);
            const confirmed = yield* Prompt.run(
              Prompt.Confirm({
                message: "Reset app data and the listed workspaces?",
                initial: false,
              }),
            ).pipe(Effect.catchTag("QuitError", () => Effect.succeed(false)));

            if (!confirmed) {
              output({ command: "reset", status: "cancelled" }, json, "Reset cancelled.");

              process.exitCode = 130;
              return;
            }
          }

          const report = yield* Effect.try(() => resetData(profile, preview));

          output(report, json, resetResultMessage(report));

          if (report.status === "cleanup-pending" || report.status === "reset-incomplete") {
            process.exitCode = 1;
          }
        }),
    ).pipe(Command.withDescription("Reset development data and known workspaces."));

    const command = root.pipe(Command.withSubcommands([dev, doctor, reset]));

    return yield* Command.runWith(command, { version: "0.0.0", renderErrors: !jsonOutput })(
      args,
    ).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          let original: unknown = error;
          if (Cause.isUnknownError(error)) {
            original = error.cause;
          }

          let code = "operation-failed";
          if (original instanceof ProfileError) {
            code = original.code;
          } else if (CliError.isCliError(error)) {
            code = "invalid-arguments";
          }
          let message = String(original);
          if (CliError.isCliError(error)) {
            message = "Invalid command. Run bun run sg --help.";
          } else if (original instanceof Error) {
            message = original.message;
          }

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
