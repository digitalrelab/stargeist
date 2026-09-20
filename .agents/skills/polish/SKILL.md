---
name: polish
description: Enforce applicable skills and materially improve code through deletion, simplification, and refactoring.
---

# Polish

- Preserve required observable behavior; internal contracts and representations may change.
- Prefer deletion and simplification over additional machinery.

## Relevant Skills

- Read and apply [$code](../code/SKILL.md) and [$tests](../tests/SKILL.md).

## Completion standard

- Assess the entire requested scope against applicable skills; trace issues through callers and dependencies.
- Fix every identified in-scope violation and material design issue.
- Re-review the resulting code after changes. Continue until a full pass finds no remaining material issue; report blockers as unfinished work.

## Cleanup

- Remove dead code and unused dependencies.
- Remove redundant state and duplicated logic.
- Remove pass-through wrappers and unnecessary indirection.
- Remove obsolete compatibility paths.
- Fix root causes and remove their workarounds.
- Remove checks duplicated by enforced contracts.
- Remove comments disallowed by $code; refactor the code when removing them exposes unclear design.

## Verification

- Run the smallest set of checks that covers the affected behavior.
- Verify that affected consumers use the replacement and superseded paths are removed; identify any blocked removal.

## Completion report

- State material improvements with concrete before-and-after evidence, or state that none were justified.
- State verification results, breaking changes, migration requirements, and any blockers or material tradeoffs.
- Omit file inventories, implementation walkthroughs, and design-pattern names.
