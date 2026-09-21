import { Effect, FileSystem, Schema } from "effect";
import { createHash } from "node:crypto";
import { ChecksError, decode, JobResults } from "./input.ts";
import type { Plan } from "./plan.ts";

export function referenceFor(plan: Plan) {
  return {
    version: plan.version,
    base: plan.change.base,
    head: plan.change.head,
    workingTree: plan.change.workingTree,
    digest: createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
  };
}

export const publishPlan = Effect.fn("checks.publishPlan")(function* (
  plan: Plan,
  output: string,
  summary: string | undefined,
) {
  const fs = yield* FileSystem.FileSystem;
  const outputs = [
    `plan=${JSON.stringify(referenceFor(plan))}`,
    `matrix=${JSON.stringify(plan.matrix)}`,
    `has-targets=${plan.matrix.include.length > 0}`,
  ];

  yield* fs.writeFileString(output, `${outputs.join("\n")}\n`, { flag: "a" });

  if (summary) {
    yield* fs.writeFileString(
      summary,
      `## Check plan\n\n\`\`\`json\n${JSON.stringify(plan, null, 2)}\n\`\`\`\n`,
      { flag: "a" },
    );
  }
});

export const verifyResults = Effect.fn("checks.verifyResults")(function* (source: unknown) {
  const results = yield* decode(Schema.fromJsonString(JobResults), source, "GitHub job results");
  const prepare = results.prepare;

  if (prepare.result !== "success") {
    return yield* new ChecksError({
      message: `Planning or quality checks did not succeed: ${String(prepare.result)}`,
    });
  }

  const hasTargets = yield* decode(
    Schema.Literals(["true", "false"]),
    prepare.outputs?.["has-targets"],
    "prepare has-targets output",
  );
  const targets = results.targets;
  let expected = "success";

  if (hasTargets === "false") {
    expected = "skipped";
  }

  if (targets.result !== expected) {
    return yield* new ChecksError({
      message: `Platform checks must be ${expected}; received ${String(targets.result)}`,
    });
  }
});
