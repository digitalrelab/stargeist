import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { inspectProfile, inspectProfileAccess } from "./desktop/index";
import { satisfies } from "semver";
import type { ToolingContext } from "./context";

type Check = { name: string; status: "ok" | "warning" | "error"; message: string };

export function diagnose(context: ToolingContext) {
  const checks: Check[] = [];
  const nodeRequirement = context.manifest.engines.node;

  checks.push({
    name: "node",
    status: satisfies(process.versions.node, nodeRequirement) ? "ok" : "error",
    message: `${process.versions.node} (required ${nodeRequirement})`,
  });

  const bun = spawnSync("bun", ["--version"], {
    encoding: "utf8",
    timeout: 5000,
    windowsHide: true,
  });
  const bunVersion = bun.stdout?.trim() ?? "";
  const bunRequirement = context.manifest.packageManager.replace(/^bun@/, "");

  checks.push({
    name: "bun",
    status: bun.status === 0 && bunVersion === bunRequirement ? "ok" : "error",
    message: `${bunVersion || "not available"} (pinned ${bunRequirement})`,
  });

  for (const [name, packagePath] of [
    ["electron", "apps/sg-desktop"],
    ["vite-plus", "."],
  ] as const) {
    try {
      const require = createRequire(join(context.checkout, packagePath, "package.json"));
      require.resolve(name);

      checks.push({ name, status: "ok", message: "Installed" });
    } catch {
      checks.push({
        name,
        status: "error",
        message: "Dependency missing; run bun install.",
      });
    }
  }

  try {
    const ownership = inspectProfile(context.profile);

    checks.push({
      name: "profile",
      status: ownership === "unmanaged" ? "warning" : "ok",
      message:
        ownership === "ready"
          ? "Owned by this checkout"
          : ownership === "missing"
            ? "Not initialized yet"
            : "Close old instances and start the updated desktop to establish ownership.",
    });

    const access = inspectProfileAccess(context.profile);

    checks.push({
      name: "coordination",
      status: access === "not-initialized" && ownership === "ready" ? "error" : "ok",
      message: access === "busy" ? "Profile is in use; reset will refuse." : access,
    });
  } catch (error) {
    checks.push({
      name: "profile",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    command: "doctor" as const,
    status: checks.some((check) => check.status === "error")
      ? ("failed" as const)
      : ("ok" as const),
    checkout: context.checkout,
    profile: context.profile.root,
    checks,
  };
}
