import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";

export function identifyDirectory(path: string) {
  const canonical = realpathSync(path);
  const directory = process.platform === "win32" ? canonical.toLowerCase() : canonical;
  const identity = createHash("sha256").update(directory).digest("hex").slice(0, 16);

  return { directory, identity };
}
