---
name: tests
description: Design, review, and maintain tests.
---

# Tests

## Selection

- Add tests or recommend more coverage only for concrete gaps in required behavior or material failure protection. Require the additional protection to justify maintenance and execution cost.
- Stop adding cases when they repeat existing protection; retain cases for distinct rules, boundaries, and failure modes.
- Choose a test scope that can expose the relevant failure. Exercise real component interactions when correctness depends on their integration.
- Treat coverage as evidence of execution, not assertion quality. Test counts, missing test files, and uncovered lines alone do not justify additional tests.

## Expectations

- Derive expected results from requirements, contracts, or independently established examples.
- Do not use the implementation under test to generate its own expected results or duplicate its logic in the test.
- Distinguish tests that preserve observed behavior from tests that establish required behavior.
- Assert outcomes precisely enough to reject plausible incorrect results; successful execution alone is insufficient.

## Contracts

- Test through consumer interfaces and keep tests valid across internal refactors that preserve the tested contract.
- Avoid assertions on private state, internal structure, or incidental call order.
- Assert interactions when the interaction itself is required behavior.
- Do not mock the behavior the test claims to protect. Account for what replaced dependencies leave untested.

## Reliability

- Isolate mutable state so tests do not depend on execution order. Control clocks, randomness, and external dependencies where they affect reproducibility.
- Wait for observable completion or conditions instead of fixed sleeps. Fix intermittent failures rather than masking them with retries.

## Failure detection

- For bug fixes, establish that the regression test fails against the buggy behavior and passes with the fix where feasible.
- Confirm that the failure comes from the intended behavioral assertion, not broken setup or unrelated errors.
- When assertion strength is uncertain, consider a targeted temporary fault to check whether the test detects it; restore the code afterward.

## Maintenance and review

- Remove tests for retired behavior or tests that add no distinct failure protection. Overlapping assertions or coverage do not establish redundancy across different integration boundaries.
- Investigate failures; change expectations or snapshots only when requirements or evidence justify the change.
- Do not weaken assertions, skip cases, or delete failing tests merely to make checks pass.
