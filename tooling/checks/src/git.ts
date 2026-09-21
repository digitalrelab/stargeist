import { Effect } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChecksError } from "./input.ts";
import { capture } from "./process.ts";

export function git(root: string, ...args: string[]) {
  return capture(
    ChildProcess.make("git", args, {
      cwd: root,
      stdin: "ignore",
      stderr: "inherit",
    }),
  );
}

export const checkCheckout = Effect.fn("checks.checkCheckout")(function* (
  root: string,
  expectedHead?: string,
) {
  const head = yield* git(root, "rev-parse", "HEAD");

  if (expectedHead && head !== expectedHead) {
    return yield* new ChecksError({ message: "The checked-out commit changed during checks" });
  }

  const status = yield* git(root, "status", "--porcelain", "--untracked-files=normal");

  if (status) {
    return yield* new ChecksError({ message: "Committed checks require a clean working tree" });
  }
});

export function rootAt(directory: string) {
  return git(directory, "rev-parse", "--show-toplevel");
}
