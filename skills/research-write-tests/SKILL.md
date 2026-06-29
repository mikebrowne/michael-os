---
name: research-write-tests
description: Add test plan to PRD and author one hash-locked acceptance test.
metadata:
  scope: [engineering-lead]
  allowed-tools: [save-test-artifacts]
  allowed-workflows: []
  status: active
  tags: [engineering]
  version: 0.1.0
---

# Research and write tests

Define "done" before implementation.

## Rules

- Read the PRD for the work item slug.
- Write a short **Test Plan** section (prose): what behaviors matter and why.
- Author **one** Vitest acceptance test file content that:
  - Lives at `tests/acceptance/agent-build.test.ts` (relative path for handoff)
  - Uses ESM imports with `../../src/...js` paths
  - Tests observable behavior only (not implementation details)
  - Will FAIL against the current codebase (red gate)
- Call `save-test-artifacts` with slug, test plan markdown, and acceptance test source.
- Ask the operator before calling `run-build`.

Do NOT write a full unit test suite here — Cursor writes unit tests in its inner loop.
