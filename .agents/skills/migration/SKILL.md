---
name: migration
description: Use only when explicitly invoked to record or execute a project migration.
---

# Migration

## Shared rules

- Store records in `.migration/` at the project root, named `YYYY-MM-DD-short-title.md`.
- `pending/` contains outstanding execution, recovery, or verification.
- `completed/` contains permanent history of verified final outcomes with no outstanding work.
- Follow the template hierarchy: concise change summary, then grouped operational details in short bullets. Omit empty or inapplicable fields, instructions, extra sections, and repeated information.
- Include only details that define the change, affect execution, recovery, or verification, or explain the outcome.
- State decisions as standalone facts. Exclude conversation history, speaker attribution, assistant narration, and drafting commentary.
- Never include secret values, credentials, or filesystem paths in records. Identify targets and resources by stable logical names.
- Resolve questions from code, records, and target state. Ask the user only for information or decisions that cannot be established independently.

## Record

- Inspect the relevant implementation and existing records. Defer migration implementation until Execute.
- Read and follow the [Pending template](./templates/TEMPLATE_PENDING.md) to create a record or update the existing entry for the same migration.
- Delete an obsolete pending record only if execution never started.
- If an obsolete migration has started, preserve its history, establish the revised intended state and remaining work for every affected target, and finish through Execute.

## Execute

### Prepare and preflight

- Read the record and [Pending template](./templates/TEMPLATE_PENDING.md); create the record through Record if absent. Confirm the target, scope, and work already applied against the current implementation and target state.
- Check required access, dependencies, deployment ordering, and any concurrent writes or running application versions that affect correctness.
- Prepare the execution method, retry or resumption behavior, and recovery from destructive changes. Verify required recovery resources are usable.
- Validate the approach without modifying the target; establish verification and stop conditions.
- Update the pending record with the prepared plan and preflight findings.

### Approval

- Resolve blockers, then summarize the plan, preflight evidence, remaining uncertainty, and expected impact. Explain why execution is ready.
- Ask for explicit approval of the prepared plan and wait. Do not modify the target before approval.

### Run and verify

- Recheck preflight assumptions before running. If they no longer hold or the plan changes, repeat affected preparation and obtain renewed approval.
- Execute the approved plan; stop on defined stop conditions or behavior outside the plan.
- Update Progress in the pending record after each target or interrupted attempt.
- Keep the record pending until every affected target reaches its intended state and passes verification.

### Finalize

- Read and follow the [Completed template](./templates/TEMPLATE_COMPLETED.md) to condense the same record into its final account.
- Move the record to completed, then remove temporary execution artifacts.
