import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { StoragePaths } from "./paths";

export class TemporaryStorage extends Context.Service<
  TemporaryStorage,
  { readonly directory: string }
>()("@stargeist/desktop/TemporaryStorage") {}

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

export const temporaryStorageLayer = Layer.effect(
  TemporaryStorage,
  Effect.gen(function* () {
    const { temporary } = yield* StoragePaths;

    yield* Effect.promise(() => mkdir(temporary, { recursive: true }));

    yield* Effect.promise(() => removeAbandonedSessions(temporary));

    const session = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(join(temporary, `session-${process.pid}-`))),
      (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
    );

    return { directory: session };
  }),
);
