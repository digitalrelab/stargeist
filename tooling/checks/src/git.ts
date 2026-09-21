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
  head = "HEAD",
  committed = true,
) {
  const revision = yield* git(
    root,
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${head}^{commit}`,
  );

  if (revision !== (yield* git(root, "rev-parse", "HEAD"))) {
    return yield* new ChecksError({
      message: "Check out the requested head before planning or running checks",
    });
  }

  if (committed) {
    const status = yield* git(root, "status", "--porcelain", "--untracked-files=normal");

    if (status) {
      return yield* new ChecksError({ message: "Committed checks require a clean working tree" });
    }
  }

  return revision;
});

export const changes = Effect.fn("checks.changes")(function* (
  root: string,
  base: string | undefined,
  head = "HEAD",
  workingTree = true,
) {
  const revision = yield* checkCheckout(root, head, !workingTree);

  let resolvedBase: string | null = null;
  const files = new Set<string>();

  if (base !== undefined) {
    const commit = yield* git(
      root,
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${base}^{commit}`,
    );

    resolvedBase = yield* git(root, "merge-base", commit, revision);

    const committedFiles = yield* git(
      root,
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      resolvedBase,
      revision,
      "--",
    );

    for (const file of committedFiles.split("\0")) {
      if (file) {
        files.add(file);
      }
    }
  }

  if (workingTree) {
    const trackedFiles = yield* git(
      root,
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      "HEAD",
      "--",
    );
    const untrackedFiles = yield* git(root, "ls-files", "--others", "--exclude-standard", "-z");

    for (const file of [...trackedFiles.split("\0"), ...untrackedFiles.split("\0")]) {
      if (file) {
        files.add(file);
      }
    }
  }

  return { base: resolvedBase, head: revision, workingTree, files: [...files].sort() };
});

export function rootAt(directory: string) {
  return git(directory, "rev-parse", "--show-toplevel");
}
