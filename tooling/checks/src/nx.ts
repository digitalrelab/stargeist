import { createRequire } from "node:module";
import { Effect, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ChecksError, decode, Platform } from "./input.ts";
import { planChecks } from "./plan.ts";
import type { WorkspacePackage } from "./plan.ts";
import { capture } from "./process.ts";
import { git } from "./git.ts";

const executable = createRequire(import.meta.url).resolve("nx/bin/nx.js");

const ProjectGraph = Schema.Struct({
  graph: Schema.Struct({
    nodes: Schema.Record(
      Schema.String,
      Schema.Struct({
        name: Schema.NonEmptyString,
        data: Schema.Struct({
          root: Schema.NonEmptyString,
          targets: Schema.Record(Schema.String, Schema.Unknown),
          tags: Schema.optionalKey(Schema.Array(Schema.String)),
        }),
      }),
    ),
  }),
});

export const nxEnvironment = Effect.fn("checks.nxEnvironment")(function* (root: string) {
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    VP_GIT_HOOKS: "0",
    NX_DAEMON: "false",
    NX_LOAD_DOT_ENV_FILES: "false",
  };
  delete environment.NX_BASE;
  delete environment.NX_HEAD;

  const variables = yield* git(root, "rev-parse", "--local-env-vars");

  for (const variable of variables.split("\n")) {
    delete environment[variable];
  }

  return environment;
});

export function nxCommand(
  root: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  options: Pick<ChildProcess.CommandOptions, "stdout"> = {},
) {
  return ChildProcess.make(process.execPath, [executable, ...args], {
    cwd: root,
    stdin: "ignore",
    ...options,
    stderr: "inherit",
    env: environment,
    extendEnv: false,
  });
}

export const readWorkspace = Effect.fn("checks.readWorkspace")(function* (
  root: string,
  base: string,
  committed: boolean,
) {
  const environment = yield* nxEnvironment(root);
  const selectionArgs = ["show", "projects", "--json"];

  if (base) {
    selectionArgs.push("--affected", "--base", base);

    if (committed) {
      selectionArgs.push("--head", "HEAD");
    }
  }

  const selection = yield* capture(nxCommand(root, selectionArgs, environment));
  const names = yield* decode(
    Schema.fromJsonString(Schema.Array(Schema.String)),
    selection,
    "Nx selected projects",
  );

  const output = yield* capture(
    nxCommand(root, ["graph", "--print", "--affected", "--base=HEAD", "--head=HEAD"], environment),
  );
  const { graph } = yield* decode(Schema.fromJsonString(ProjectGraph), output, "Nx project graph");
  const packages: WorkspacePackage[] = [];

  for (const node of Object.values(graph.nodes).sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (node.data.root === ".") {
      continue;
    }

    const tags = (node.data.tags ?? []).filter((tag) => tag.startsWith("platform:"));
    const platforms = yield* decode(
      Schema.Array(Platform).check(Schema.isMinLength(1), Schema.isUnique()),
      tags.map((tag) => tag.slice("platform:".length)),
      `${node.name}: platform tags`,
    );

    if (!Object.hasOwn(node.data.targets, "typecheck")) {
      return yield* new ChecksError({ message: `${node.name}: missing typecheck target` });
    }

    packages.push({
      name: node.name,
      directory: node.data.root,
      platforms: [...platforms],
      tests: Object.hasOwn(node.data.targets, "test"),
      build: Object.hasOwn(node.data.targets, "ci:build"),
    });
  }

  return planChecks(packages, new Set(names));
});
