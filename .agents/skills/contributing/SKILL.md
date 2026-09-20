---
name: contributing
description: Write commit messages and pull request titles and descriptions. Use when preparing commits or creating or updating pull requests.
---

# Contributing

## Shared format

- Use Conventional Commits for commit subjects and PR titles: `<type>(<scope>)[!]: <plain-language subject>`.
- Allowed types: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`. Use `feat` for a new capability, `fix` for a bug fix, and `!` for a breaking change.
- Scopes are required and describe the area affected by the change.

## Commits

- Keep each commit to one coherent change and name that change in its subject.
- In commit bodies, state the problem in one or two sentences, then explain the fix.

## Pull requests

- Title the PR for its overall intended outcome. Change the title only when that outcome changes, not as commits land.
- Open with one short sentence, without a heading: what can someone now do, or what problem goes away? Use plain words; avoid jargon, vague claims, and implementation details.
- Follow with `## Changes` and short, flat bullets, one point each. Omit the section when the opening sentence covers the change.
- Explain what changes and why it matters. Include only details that help the reviewer assess the change. Remove anything that adds length without adding understanding.
- Use ordinary bullets for delivered changes; reserve checkboxes for work tracked in a draft PR.
- Update the body to reflect the current scope and resulting behavior. Replace stale text; omit progress logs, abandoned approaches, and conversation history.

Example title: `feat(projects): allow reopening closed projects`

Example body:
```markdown
Resume work on a closed project without creating a new one.

## Changes

- Add a Reopen action to closed projects.
- Restore reopened projects to the active list.
```
