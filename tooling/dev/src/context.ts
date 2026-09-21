import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentProfile } from "./desktop/index";

export const checkout = realpathSync(fileURLToPath(new URL("../../..", import.meta.url)));

export function toolingContext() {
  const manifest = JSON.parse(readFileSync(join(checkout, "package.json"), "utf8")) as {
    engines: { node: string };
    packageManager: string;
  };

  return { checkout, manifest, profile: developmentProfile(join(checkout, "apps", "sg-desktop")) };
}

export type ToolingContext = ReturnType<typeof toolingContext>;
