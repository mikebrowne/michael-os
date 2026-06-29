---
name: ship
description: Commit planning docs or green implementation to main with operator approval.
metadata:
  scope: [engineering-lead]
  allowed-tools: [ship-docs, ship-implementation]
  allowed-workflows: []
  status: active
  tags: [engineering]
  version: 0.1.0
---

# Ship

Two separate ship actions — never combine them in one commit.

## ship-docs

Use when the PRD and grill notes are ready (before or after a build).

1. Confirm slug and that `docs/prds/<slug>.md` and `.grill.md` exist.
2. Draft a concise commit message (e.g. `docs: add <slug> PRD and grill notes`).
3. Call `ship-docs` with slug and commitMessage.
4. Tell the operator to reply **YES** when the gateway asks for approval.

## ship-implementation

Use only after a **green** `run-build` result in this session.

1. Confirm `lastBuildResult` from the tool was success / green.
2. Draft a commit message for the implementation (e.g. `feat: add greet utility`).
3. Call `ship-implementation` with commitMessage.
4. Tell the operator to reply **YES** for approval.

Never ship implementation on a red build. Never modify `tests/acceptance/**` in the implementation commit.
