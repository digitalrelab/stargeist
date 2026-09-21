import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { openDirectoryCache } from "./index";

it("reports unavailable temporary storage without masking the failure during cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "stargeist-cache-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const error = await Effect.runPromise(
    openDirectoryCache(join(root, "missing", "listing.sqlite")).pipe(Effect.flip, Effect.scoped),
  );

  expect(error).toMatchObject({
    _tag: "DirectoryError",
    code: "StorageUnavailable",
    message: "Temporary storage could not be used. Check available disk space, then refresh.",
  });
});
