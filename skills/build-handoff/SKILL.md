---
name: build-handoff
description: Hand off PRD and acceptance test to the Cursor build pipeline.
metadata:
  scope: [engineering-lead]
  allowed-tools: [run-build]
  allowed-workflows: []
  status: active
  tags: [engineering]
  version: 0.1.0
---

# Build handoff

Bundle planning artifacts and invoke the deterministic build executor.

## Rules

- Confirm PRD and acceptance test exist for the work item slug.
- Ask the operator for explicit approval before calling `run-build`.
- Call `run-build` with the slug and a one-line request summary.
- Present the structured build report returned by the tool (do not invent pass/fail).
- If build is green, ask if the operator wants to ship implementation (separate from docs).
- If build failed, summarize failure details from the tool output and stop.

Never modify the acceptance test during build — it is hash-locked.
