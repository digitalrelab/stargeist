import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";

function isProcessGone(pid: number) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error)) return false;

    return error.code === "ESRCH";
  }
}

async function removeAbandonedSessions(temporary: string) {
  const entries = await readdir(temporary, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pid = /^session-([1-9][0-9]*)-[a-zA-Z0-9]+$/.exec(entry.name)?.[1];

    if (!pid || !isProcessGone(Number(pid))) continue;

    await rm(join(temporary, entry.name), { recursive: true, force: true });
  }
}

export const temporarySession = Effect.fnUntraced(function* (temporary: string) {
  yield* Effect.tryPromise(() => mkdir(temporary, { recursive: true }));
  yield* Effect.tryPromise(() => removeAbandonedSessions(temporary));
  return yield* Effect.acquireRelease(
    Effect.tryPromise(() => mkdtemp(join(temporary, `session-${process.pid}-`))),
    (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
  );
});
