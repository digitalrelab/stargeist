import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { fixture } from "./fixture.test-support.ts";

it("selects affected consumers", () => {
  const repo = fixture();
  repo.write("packages/shared/src/index.ts", "export const value = 2;\n");
  const result = repo.run(["plan"], {
    CHECKS_BASE: repo.base,
    NX_BASE: "ignored",
    NX_HEAD: "ignored",
  });

  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
    "shared",
    "website",
  ]);
}, 15000);

it("broadens shared configuration changes", () => {
  const repo = fixture();
  repo.write("vite.config.ts", "");
  const result = repo.run(["plan", "--base", repo.base]);

  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
    "shared",
    "unrelated",
    "website",
  ]);
}, 15000);

it("rejects invalid bases", () => {
  const repo = fixture();
  expect(repo.run(["plan", "--base", "missing-ref"]).status).toBe(1);
}, 15000);

it.each([
  {
    name: "rejects missing project policy",
    file: "packages/new/package.json",
    content: { name: "new", scripts: { typecheck: 'node -e ""' } },
    message: "platform tags",
  },
  {
    name: "rejects missing typecheck targets",
    file: "packages/new/package.json",
    content: { name: "new", nx: { tags: ["platform:linux"] } },
    message: "missing typecheck target",
  },
  {
    name: "rejects broken Nx graphs",
    file: "bun.lock",
    content: "invalid lockfile",
    message: "Command failed",
  },
])(
  "$name",
  ({ file, content, message }) => {
    const repo = fixture();
    repo.write(file, content);
    const result = repo.run(["plan"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  },
  15000,
);

it("publishes the matrix and work requirement consumed by CI", () => {
  const repo = fixture();
  const output = join(repo.root, ".cache/output");
  repo.write(".cache/output", "");

  const result = repo.run(["plan", "--committed", "--github"], { GITHUB_OUTPUT: output });

  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(output, "utf8")).toBe(
    [
      'matrix={"include":[{"platform":"linux","runner":"ubuntu-24.04","desktop":false}]}',
      "has-targets=true",
      "",
    ].join("\n"),
  );
}, 15000);

it("stops before tests when quality checks fail", () => {
  const repo = fixture();

  repo.write("check.cjs", "process.exit(17);\n");
  repo.write("packages/shared/package.json", {
    name: "shared",
    scripts: { typecheck: 'node -e ""', test: "node test.cjs" },
    nx: { tags: ["platform:linux", "platform:darwin", "platform:win32"] },
  });
  repo.write("packages/shared/test.cjs", "require('node:fs').writeFileSync('../../test-ran', '');");
  const result = repo.run(["run"]);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Check failed: nx run-many");
  expect(existsSync(join(repo.root, "test-ran"))).toBe(false);
}, 15000);

it("clears Git's hook environment before launching package checks", () => {
  const repo = fixture();

  repo.write(
    "check.cjs",
    "if (process.env.GIT_DIR || process.env.GIT_WORK_TREE) process.exit(19);\n",
  );
  const result = repo.run(["run", "--job", "quality"], {
    GIT_DIR: join(repo.root, ".git"),
    GIT_WORK_TREE: repo.root,
  });

  expect(result.status, result.stderr).toBe(0);
}, 15000);

it("allows deletion-only pushes and refuses a different pushed commit", () => {
  const repo = fixture();
  const zeros = "0".repeat(40);

  expect(repo.run(["pre-push"], {}, `(delete) ${zeros} refs/heads/old ${repo.base}\n`).status).toBe(
    0,
  );

  repo.write("packages/shared/src/index.ts", "export const value = 2;\n");
  repo.commit();
  const result = repo.run(
    ["pre-push"],
    {},
    `refs/heads/old ${repo.base} refs/heads/old ${zeros}\n`,
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("checked-out commit separately");
}, 15000);

it.each(["pre-push", "run"])(
  "rejects %s when its checkout changes during validation",
  (command) => {
    const repo = fixture();
    const zeros = "0".repeat(40);

    repo.write(
      "check.cjs",
      "require('node:fs').writeFileSync('packages/shared/src/index.ts', 'changed during checks');\n",
    );
    const head = repo.commit();
    let args = ["pre-push"];

    if (command === "run") {
      args = ["run", "--job", "quality", "--committed"];
    }

    const result = repo.run(args, {}, `refs/heads/main ${head} refs/heads/main ${zeros}\n`);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("clean working tree");
    expect(repo.run(["plan", "--committed"]).stderr).toContain("clean working tree");
  },
  15000,
);
