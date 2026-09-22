import { endianness } from "node:os";
import { FileError } from "@stargeist/domain";
import { reportFailure } from "@stargeist/std/errors";
import { Effect } from "effect";
import { createDarwinIdentity } from "./darwin";
import { createLinuxIdentity } from "./linux";
import { createWindowsIdentity } from "./windows";
import { IdentityUnavailable, ObservationExpired } from "./errors";
import type { IdentityAdapter, IdentityComparison } from "./types";

export { IdentityUnavailable } from "./errors";

const adapters: Partial<Record<NodeJS.Platform, () => IdentityAdapter>> = {
  darwin: createDarwinIdentity,
  linux: createLinuxIdentity,
  win32: createWindowsIdentity,
};

let adapter: IdentityAdapter | undefined;

function currentAdapter() {
  if (adapter) return adapter;
  const create = adapters[process.platform];
  if (!create || endianness() !== "LE" || !["x64", "arm64"].includes(process.arch)) {
    throw new IdentityUnavailable("File recognition is unavailable on this platform.");
  }
  adapter = create();
  return adapter;
}

export async function readFileIdentity(path: string) {
  if (path.includes("\0")) throw new IdentityUnavailable("The file path is invalid.");
  try {
    return await currentAdapter().read(path);
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      if (error.code === "ENOENT") return null;
      if (["ENOTSUP", "EOPNOTSUPP", "ENOTTY", "ENOSYS"].includes(String(error.code))) {
        throw new IdentityUnavailable("This filesystem does not support file recognition.", {
          cause: error,
        });
      }
    }
    throw error;
  }
}

export const verifyFileIdentities = (comparisons: ReadonlyArray<IdentityComparison>) =>
  Effect.tryPromise({
    try: async () => {
      const verify = currentAdapter().verify;
      if (verify) return verify(comparisons);
      return comparisons.map(({ previous, current }) => {
        if (previous.evidence !== null || current.evidence !== null) {
          throw new IdentityUnavailable("The file's identity could not be verified.");
        }
        if (previous.source === current.source && previous.objectKey === current.objectKey) {
          return "same" as const;
        }
        return "different" as const;
      });
    },
    catch: (error) => error,
  }).pipe(
    Effect.onError((cause) => reportFailure("files.identity.verify", cause)),
    Effect.mapError((error) => {
      if (error instanceof ObservationExpired) {
        return new FileError({ code: "ObservationExpired", message: error.message });
      }
      return new FileError({
        code: "IdentityUnavailable",
        message: "The file's identity could not be verified.",
      });
    }),
  );
