import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onTestFinished } from "vite-plus/test";

const executable = fileURLToPath(new URL("../bin/checks.mjs", import.meta.url));
const require = createRequire(import.meta.url);

export function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stargeist checks "));

  onTestFinished(() => rmSync(root, { recursive: true, force: true }));

  function write(path: string, value: unknown) {
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    let content = JSON.stringify(value);

    if (typeof value === "string") {
      content = value;
    }

    writeFileSync(destination, content);
  }

  function git(...args: string[]) {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }

  function commit() {
    git("add", ".");
    git(
      "-c",
      "core.hooksPath=.git/no-hooks",
      "-c",
      "user.name=Checks",
      "-c",
      "user.email=checks@example.test",
      "commit",
      "-qm",
      "fixture",
    );

    return git("rev-parse", "HEAD");
  }

  function run(args: string[], env: Record<string, string> = {}, input = "") {
    return spawnSync(process.execPath, [executable, ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 20000,
      input,
      env: { ...process.env, CHECKS_BASE: "", ...env },
    });
  }

  write("package.json", {
    name: "stargeist",
    private: true,
    workspaces: ["packages/*", "apps/*"],
    scripts: { check: "node check.cjs", "typecheck:tools": 'node -e ""' },
    nx: { includedScripts: ["check", "typecheck:tools"] },
  });
  write("nx.json", readFileSync(new URL("../../../nx.json", import.meta.url), "utf8"));
  write("check.cjs", "");
  write(".gitignore", "node_modules/\n.cache/\n.nx/\n");
  write("packages/shared/package.json", {
    name: "shared",
    scripts: { typecheck: 'node -e ""' },
    nx: { tags: ["platform:linux"] },
  });
  write("packages/shared/src/index.ts", "export const value = 1;\n");
  write("apps/website/package.json", {
    name: "website",
    dependencies: { shared: "workspace:*" },
    scripts: { typecheck: 'node -e ""', "ci:build": 'node -e ""' },
    nx: { tags: ["platform:linux"] },
  });
  write("packages/unrelated/package.json", {
    name: "unrelated",
    scripts: { typecheck: 'node -e ""' },
    nx: { tags: ["platform:linux"] },
  });

  mkdirSync(join(root, "node_modules"));
  symlinkSync(
    dirname(require.resolve("nx/package.json")),
    join(root, "node_modules/nx"),
    "junction",
  );
  git("init", "-q");
  const base = commit();

  return { root, write, git, commit, run, base };
}
