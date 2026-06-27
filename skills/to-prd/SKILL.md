---
name: to-prd
description: Synthesize grill notes into a PRD and GitHub issue.
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
