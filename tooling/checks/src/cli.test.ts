import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vite-plus/test";
import { referenceFor } from "./github.ts";
import { fixture } from "./fixture.test-support.ts";

it("discovers changes and new consumers from manifests through the real CLI", () => {
  const repo = fixture();

  repo.write("packages/shared/src/index.ts", "export const value = 2;\n");
  const result = repo.run(["plan", "--base", repo.base]);

  expect(result.status, result.stderr).toBe(0);
  const plan = JSON.parse(result.stdout);

  expect(plan.packages.map((pkg: { name: string }) => pkg.name)).toEqual(["shared", "website"]);
  expect(plan.change.files).toEqual(["packages/shared/src/index.ts"]);
  expect(plan.matrix.include).toEqual([
    { platform: "linux", runner: "ubuntu-24.04", desktop: false },
  ]);
}, 15000);

it("includes both sides of moves across package boundaries", () => {
  const repo = fixture();

  repo.write(
    "apps/website/src/index.ts",
    readFileSync(join(repo.root, "packages/shared/src/index.ts"), "utf8"),
  );
  repo.git("rm", "packages/shared/src/index.ts");
  repo.commit();
  const result = repo.run(["plan", "--committed", "--base", repo.base]);

  expect(result.status, result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).change.files).toEqual([
    "apps/website/src/index.ts",
    "packages/shared/src/index.ts",
  ]);
}, 15000);

it("rejects projects without platform tags or a typecheck target", () => {
  const repo = fixture();

  repo.write("packages/new/package.json", {
    name: "new",
    scripts: { typecheck: 'node -e ""' },
  });

  const missingContract = repo.run(["plan"]);

  expect(missingContract.status).toBe(1);
  expect(missingContract.stderr).toContain("platform tags");

  repo.write("packages/new/package.json", {
    name: "new",
    nx: { tags: ["platform:linux"] },
  });

  const missingTarget = repo.run(["plan"]);

  expect(missingTarget.status).toBe(1);
  expect(missingTarget.stderr).toContain("missing typecheck target");
}, 15000);

it("does not silently broaden an invalid Git revision into a successful empty plan", () => {
  const repo = fixture();

  expect(repo.run(["plan", "--base", "missing-ref"]).status).toBe(1);
}, 15000);

it("rejects dirty committed plans and plans for a different checkout", () => {
  const repo = fixture();
  const first = repo.run(["plan", "--committed", "--base", repo.base]);

  expect(first.status, first.stderr).toBe(0);
  repo.write("packages/shared/src/index.ts", "export const value = 2;\n");
  expect(repo.run(["plan", "--committed"]).stderr).toContain("clean working tree");
  repo.commit();
  const stale = repo.run(["run", "--job", "quality"], {
    CHECKS_PLAN: JSON.stringify(referenceFor(JSON.parse(first.stdout))),
  });

  expect(stale.status).toBe(1);
  expect(stale.stderr).toContain("requested head");
}, 15000);

it("rejects a plan with required work removed", () => {
  const repo = fixture();
  const plan = JSON.parse(repo.run(["plan", "--committed"]).stdout);
  plan.packages = [];
  const result = repo.run(["run", "--job", "quality"], {
    CHECKS_PLAN: JSON.stringify(referenceFor(plan)),
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("does not match this checkout");
}, 15000);

it("verifies the GitHub result contract", () => {
  const repo = fixture();
  const results = {
    prepare: {
      result: "success",
      outputs: { "has-targets": "false" },
    },
    targets: { result: "skipped" },
  };
  const result = repo.run(["verify"], { CHECKS_RESULTS: JSON.stringify(results) });

  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("All required checks succeeded");
  results.targets.result = "cancelled";
  expect(repo.run(["verify"], { CHECKS_RESULTS: JSON.stringify(results) }).status).toBe(1);
}, 15000);

it("stops execution when a task fails", () => {
  const repo = fixture();

  repo.write("check.cjs", "process.exit(17);\n");
  const result = repo.run(["run", "--job", "quality"]);

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Check failed: nx run-many");
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

it("publishes the plan and work requirement consumed by CI", () => {
  const repo = fixture();
  const output = join(repo.root, ".cache/output");

  repo.write(".cache/output", "");

  const result = repo.run(["plan", "--committed", "--github"], { GITHUB_OUTPUT: output });

  expect(result.status, result.stderr).toBe(0);

  const lines = readFileSync(output, "utf8").trim().split("\n");
  const reference = lines.find((line) => line.startsWith("plan="))!.slice(5);
  const outputs = Object.fromEntries(
    lines.map((line) => {
      const separator = line.indexOf("=");

      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
  const results = {
    prepare: { result: "success", outputs },
    targets: { result: "success" },
  };

  expect(JSON.parse(reference)).toMatchObject({ head: repo.base, digest: expect.any(String) });
  expect(reference.length).toBeLessThan(300);
  expect(repo.run(["verify"], { CHECKS_RESULTS: JSON.stringify(results) }).status).toBe(0);
}, 15000);

it("allows deletion-only pushes and refuses to validate a different pushed commit", () => {
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
  },
  15000,
);

it.each(["vite.config.ts", ".github/workflows/build.yml", "tooling/checks/src/policy.ts"])(
  "selects all projects when a shared input changes: %s",
  (path) => {
    const repo = fixture();

    repo.write(path, "");
    const result = repo.run(["plan", "--base", repo.base]);

    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
      "shared",
      "unrelated",
      "website",
    ]);
  },
  15000,
);

it("selects remaining projects when a workspace package is deleted", () => {
  const repo = fixture();

  repo.git("rm", "-r", "packages/shared");
  repo.write("apps/website/package.json", {
    name: "website",
    scripts: { typecheck: 'node -e ""' },
    nx: { tags: ["platform:linux"] },
  });
  repo.commit();
  const result = repo.run(["plan", "--committed", "--base", repo.base]);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
    "unrelated",
    "website",
  ]);
}, 15000);

it("passes filenames containing spaces and commas to Nx intact", () => {
  const repo = fixture();

  repo.write("packages/shared/src/with spaces,and commas.ts", "export {};\n");
  const result = repo.run(["plan", "--base", repo.base]);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
    "shared",
    "website",
  ]);
}, 15000);

it("selects all projects for a valid lockfile change and rejects a malformed lockfile", () => {
  const repo = fixture();

  repo.write("bun.lock", {
    lockfileVersion: 2,
    workspaces: { "": { name: "stargeist" } },
    packages: {},
  });
  const result = repo.run(["plan", "--base", repo.base]);

  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout).packages.map((pkg: { name: string }) => pkg.name)).toEqual([
    "shared",
    "unrelated",
    "website",
  ]);

  repo.write("bun.lock", "invalid lockfile");
  const invalid = repo.run(["plan"]);

  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain("Command failed");
}, 15000);
