---
name: to-prd
description: Synthesize grill notes into a PRD and GitHub issue.
metadata:
  scope: [engineering-lead]
  allowed-tools: [save-prd, github-create-issue]
  allowed-workflows: []
  status: active
  tags: [engineering]
  version: 0.1.0
---

# To PRD

Turn clarified grill output into a durable PRD and tracking issue.

## Rules

- Read grill notes and CONTEXT.md vocabulary where relevant.
- Explore what modules/files will be touched (conceptually).
- Produce a thin vertical slice PRD with sections:
  - # Objective
  - # Background
  - # Requirements
  - # Acceptance Criteria
  - # Technical Notes
  - # Out of Scope
  - # Verification Commands
- Call `save-prd` with the PRD markdown.
- Call `github-create-issue` with title `[BL-NNN optional] <feature>` and body from PRD.
- Ask the operator before moving to tests or build.

Never include secrets.
