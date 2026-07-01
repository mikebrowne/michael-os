---
name: write-workflow
description: Author a deterministic workflow via the full code pipeline with a test.
metadata:
  scope: [engineering-lead]
  allowed-tools: [propose-extension, scaffold-workflow, request-activation, stage-implementation, verify-build, promote]
  allowed-workflows: []
  status: active
  tags: [authoring, workflow]
  version: 0.1.0
---

# Write workflow (Workflow Author)

Author a **workflow** — fixed ordering of tools/skills — as real code through the full pipeline.

## Process

1. Call `propose-extension` with form **workflow** before building.
2. After operator go-ahead, call `scaffold-workflow` with id, description, and step plan.
3. Ship a test proving the workflow runs keyless in CI.
4. Stage → verify → promote; then `request-activation` for logged operator yes.

Workflows are code today — not the lighter skill gate.

Never include secrets.
