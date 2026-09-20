import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { Effect } from "effect";

Effect.runSync(
  Effect.sync(() => {
    const directory = realpathSync(import.meta.dirname);
    const identity = createHash("sha256")
      .update(process.platform === "win32" ? directory.toLowerCase() : directory)
      .digest("hex")
      .slice(0, 16);

    process.stdout.write(`stargeist-${identity}`);
  }),
);
