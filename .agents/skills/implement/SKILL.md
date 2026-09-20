---
name: implement
description: Implement requested behavior and verify the result. Use only when explicitly invoked, before and during implementation.
---

# Implement

- Implement the requested behavior.
- Preserve existing behavior outside the requested changes.
- Read and apply [$code](../code/SKILL.md) and [$tests](../tests/SKILL.md).

## Before coding

- Read the affected code, its callers, and relevant tests.
- Identify required behavior, affected consumers, and reusable capabilities.
- Determine what must change and what must remain true.
- Identify the source of truth for each piece of state.
- Resolve ambiguity that materially affects behavior or public contracts.
- Choose a complete approach and determine how to verify it.
- Keep planning proportional to the task; proceed when the approach is clear.

## Verification

- Run the smallest set of checks that covers the affected behavior.
- Review the diff for unnecessary complexity and unintended changes.
- Verify that affected consumers use the replacement and superseded paths are removed; identify any blocked removal.
- Distinguish verified outcomes from assumptions.

## Completion report

- Briefly describe the behavior delivered and how it was verified.
- State breaking changes, migration requirements, and material limitations or tradeoffs.
- Omit file inventories, implementation walkthroughs, and design-pattern names.
