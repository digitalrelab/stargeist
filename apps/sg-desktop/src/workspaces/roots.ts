import { constants } from "node:fs";
import { lstat, mkdtemp, open, realpath, rename, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { WorkspaceError } from "@stargeist/domain";
import * as Id from "@stargeist/std/id";
import { workspaceDirectoryName, type WorkspaceRoots } from "./storage";
import { reportFailure } from "@stargeist/std/errors";
import { Clock, Effect, Schema } from "effect";

const manifestName = "workspace.json";
const maximumManifestBytes = 65536;
const { schema: Identity, generate: makeIdentity } = Id.define("wsp");
const Manifest = Schema.Struct({
  id: Identity,
  createdAt: Schema.Number,
});
const decodeManifest = Schema.decodeUnknownSync(Manifest, { onExcessProperty: "error" });
const invalid = () =>
  new WorkspaceError({
    code: "InvalidWorkspace",
    message: "Workspace metadata is invalid. Restore .stargeist/workspace.json from a backup.",
  });
const unavailable = () =>
  new WorkspaceError({
    code: "FolderUnavailable",
    message:
      "The workspace folder is unavailable. Check its location and permissions, or locate it again.",
  });
const storageUnavailable = () =>
  new WorkspaceError({
    code: "StorageUnavailable",
    message:
      "Workspace metadata could not be saved. Check folder permissions and available space, then retry.",
  });

async function syncDirectory(path: string) {
  if (process.platform === "win32") return;
  const directory = await open(path, "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}

function hasCode(error: unknown, code: string) {
  return error instanceof Error && "code" in error && error.code === code;
}

async function canonicalDirectory(path: string) {
  const root = await realpath(path);
  if (!(await stat(root)).isDirectory()) throw unavailable();
  return root;
}

async function markerExists(root: string) {
  try {
    const metadata = await lstat(join(root, workspaceDirectoryName));
    if (!metadata.isDirectory()) throw invalid();
    return true;
  } catch (error) {
    if (hasCode(error, "ENOENT")) return false;
    throw error;
  }
}

async function readManifest(root: string) {
  const filename = join(root, workspaceDirectoryName, manifestName);
  let file;
  try {
    const metadata = await lstat(filename);
    if (!metadata.isFile()) throw invalid();
    file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const bytes = Buffer.alloc(maximumManifestBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > maximumManifestBytes) throw invalid();
    let value: unknown;
    try {
      value = JSON.parse(bytes.subarray(0, length).toString("utf8"));
      const manifest = decodeManifest(value);
      return { identity: manifest.id, root, createdAt: manifest.createdAt };
    } catch {
      throw invalid();
    }
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      throw new WorkspaceError({
        code: "InvalidWorkspace",
        message:
          "Workspace metadata is missing. Restore .stargeist/workspace.json, or use Initialize workspace to retry an empty initialization.",
      });
    }
    if (hasCode(error, "ELOOP")) throw invalid();
    throw error;
  } finally {
    await file?.close();
  }
}

const readOperation = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise(run).pipe(
    Effect.onError((cause) => reportFailure(operation, cause)),
    Effect.mapError((error) => {
      if (error.cause instanceof WorkspaceError) return error.cause;
      return unavailable();
    }),
  );

export const workspaceRoots: WorkspaceRoots = {
  read: (path) =>
    readOperation("workspaces.root.read", async () => {
      const root = await canonicalDirectory(path);
      if (!(await markerExists(root))) {
        throw new WorkspaceError({
          code: "InvalidWorkspace",
          message:
            "Workspace metadata is missing. Locate the workspace folder or restore its .stargeist directory.",
        });
      }
      return readManifest(root);
    }),
  discover: (path) =>
    readOperation("workspaces.root.discover", async () => {
      let root = await canonicalDirectory(path);
      while (true) {
        if (await markerExists(root)) return readManifest(root);
        const parent = dirname(root);
        if (parent === root) return null;
        root = parent;
      }
    }),
  initialize: Effect.fnUntraced(function* (path) {
    const root = yield* readOperation("workspaces.root.resolve", () => canonicalDirectory(path));
    const id = yield* makeIdentity;
    const createdAt = yield* Clock.currentTimeMillis;
    return yield* Effect.gen(function* () {
      const directory = join(root, workspaceDirectoryName);
      const existing = yield* Effect.tryPromise(async () => {
        if (await markerExists(root)) {
          let hasManifest = true;
          try {
            await lstat(join(directory, manifestName));
          } catch (error) {
            if (!hasCode(error, "ENOENT")) throw error;
            hasManifest = false;
          }
          if (hasManifest) return readManifest(root);
          try {
            await rmdir(directory);
          } catch (error) {
            if (hasCode(error, "ENOTEMPTY") || hasCode(error, "EEXIST")) return readManifest(root);
            if (!hasCode(error, "ENOENT")) throw error;
          }
        }
      });
      if (existing) return existing;

      const temporary = yield* Effect.acquireRelease(
        Effect.tryPromise(() => mkdtemp(join(root, ".stargeist-initialize-"))),
        (path) => Effect.promise(() => rm(path, { recursive: true, force: true })),
      );
      return yield* Effect.tryPromise(async () => {
        const file = await open(join(temporary, manifestName), "wx", 0o600);
        try {
          await file.writeFile(`${JSON.stringify({ id, createdAt }, null, 2)}\n`);
          await file.sync();
        } finally {
          await file.close();
        }
        await syncDirectory(temporary);
        try {
          await rename(temporary, directory);
        } catch (error) {
          if (!(await markerExists(root))) throw error;
        }
        await syncDirectory(root);
        return await readManifest(root);
      });
    }).pipe(
      Effect.scoped,
      Effect.onError((cause) => reportFailure("workspaces.root.initialize", cause)),
      Effect.mapError((error) => {
        if ("cause" in error && error.cause instanceof WorkspaceError) return error.cause;
        return storageUnavailable();
      }),
      Effect.uninterruptible,
    );
  }),
};
