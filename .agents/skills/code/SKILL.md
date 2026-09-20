---
name: code
description: Code design practices.
---

# Code

- Prefer clear ownership, explicit boundaries, and minimal coordination.
- Resolve competing principles in favor of correctness and understandability.

## Coherent design

- Integrate changes into the design. Refactor affected code when this materially improves clarity, simplicity, or correctness.
- Prefer the simplest coherent result over the smallest diff.
- Revise or replace abstractions that no longer fit. Do not preserve them by accumulating wrappers, flags, exceptions, or duplicated paths.
- Complete replacements: migrate affected callers, update tests and documentation, and remove superseded code.
- Keep refactoring tied to the requested outcome.

## Compatibility

- Preserve required behavior, not obsolete implementation choices.
- Inspect affected consumers and persisted data before changing contracts.
- Prefer migration over compatibility paths for superseded designs.
- Temporary compatibility requires an identified dependency that cannot migrate with the change, a concrete blocker, and a removal condition.
- Report breaking changes and migration requirements. Ask before executing actions with newly discovered risks of data loss, live disruption, or uncertain recovery beyond existing authorization.

## Relevant skills

- Working on UI? Refer to [$ui](../ui/SKILL.md).
- Working on React? Refer to [$react](../react/SKILL.md).
- Working on layout? Refer to [$layout](../layout/SKILL.md).
- For folder structure, refer to [$folder-structure](../folder-structure/SKILL.md).

## Design

- Keep related logic and knowledge together.
- Keep dependencies explicit.
- Hide substantial complexity and internal decisions behind small interfaces.
- Separate responsibilities; keep each boundary's internals together.
- Reuse capabilities that fit; revise or replace those that do not.
- Introduce abstractions where they enforce a meaningful boundary or hide complexity.
- Keep similar code separate when its rules or reasons to change differ.
- Remove abstractions that neither protect boundaries nor hide complexity.
- Minimize the knowledge and coordination required from callers.
- Address hidden dependencies and mixed responsibilities exposed by difficult test setup before adding test-specific machinery.

## Extensibility

- Prefer composition.
- Remove coupling that complicates current responsibilities or required changes.
- Select and wire implementations with their owner; keep variant-specific knowledge out of callers.
- Keep integration details out of core rules.
- Add interfaces, factories, and layers only when they enforce a current contract, own policy, or isolate an integration.

## Implementation

- Represent each fact once; derive values instead of duplicating state.
- Make invalid states difficult to represent.
- Validate at boundaries; rely on enforced contracts internally.
- Handle failures explicitly; do not disguise them as successful results.
- Add dependencies only when their benefit justifies their cost.
- Do not add or retain code comments except documentation for consumer-facing public APIs and SDKs.
- Express intent through names, types, and structure. Refactor unclear code instead of explaining it with comments.
