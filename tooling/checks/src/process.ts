import { Effect, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { ChecksError } from "./input.ts";

export const capture = Effect.fn("checks.capture")(function* (command: ChildProcess.Command) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(command);
  const output = handle.stdout.pipe(
    Stream.decodeText(),
    Stream.runFoldEffect(
      () => "",
      (collected, chunk) => {
        if (collected.length + chunk.length > 16 * 1024 * 1024) {
          return Effect.fail(new ChecksError({ message: "Process output exceeded 16 MiB" }));
        }

        return Effect.succeed(collected + chunk);
      },
    ),
  );

  const [stdout, exitCode] = yield* Effect.all([output, handle.exitCode], { concurrency: 2 });

  if (exitCode !== 0) {
    return yield* new ChecksError({
      message: `Command failed with exit code ${exitCode}\n${stdout.trimEnd()}`,
    });
  }

  return stdout.trimEnd();
}, Effect.scoped);
