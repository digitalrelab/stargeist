import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspaceError } from "@stargeist/domain/workspaces";
import { Cause, Effect, Logger, References, Schema } from "effect";
import { expect, it, onTestFinished } from "vite-plus/test";
import { selectedFolder } from "./selected-folder";

it("logs filesystem diagnostics without exposing the failing path in the public error", async () => {
  const root = await mkdtemp(join(tmpdir(), "stargeist-folder-test-"));
  onTestFinished(() => rm(root, { recursive: true, force: true }));

  const path = join(root, "missing");
  const entries: Array<{ cause: Cause.Cause<unknown>; operation: unknown }> = [];
  const logger = Logger.make(({ cause, fiber }) => {
    entries.push({ cause, operation: fiber.getRef(References.CurrentLogAnnotations).operation });
  });

  const error = await Effect.runPromise(
    selectedFolder(path).pipe(Effect.flip, Effect.provide(Logger.layer([logger]))),
  );

  expect(Schema.encodeSync(WorkspaceError)(error)).toEqual({
    _tag: "WorkspaceError",
    code: "FolderUnavailable",
    message: "This folder is unavailable or cannot be read. Check its location and permissions.",
  });
  expect(entries).toHaveLength(1);
  expect(entries[0]?.operation).toBe("workspaces.folder.resolve");
  expect(Cause.squash(entries[0]!.cause)).toMatchObject({ cause: { code: "ENOENT", path } });
});
