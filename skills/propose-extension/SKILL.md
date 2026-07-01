---
name: propose-extension
description: Draft a backlog GitHub Issue proposing a self-extension before any code is built.
metadata:
  scope: [engineering-lead, skill-engineer]
  allowed-tools: [propose-extension, github-create-issue]
  allowed-workflows: []
  status: active
  tags: [authoring, proposal]
  version: 0.1.0
---

# Propose extension

Draft a **reviewable backlog Issue** before building anything. The backlog is the pending-proposals queue.

## Issue must include

1. **User story** — plain language, operator-readable
2. **Technical detail** — files/modules, gates, tests
3. **Non-technical detail** — why now, risks, reversibility
4. **Recommended form** — skill / tool / workflow / agent with rationale

## Process

1. Load **author-policy** if form is not yet decided.
2. Call `propose-extension` with all sections filled in.
3. Stop — wait for operator go-ahead on the Issue before drafting.

Reuse grill → PRD patterns where helpful; this is the "should we take on this project?" checkpoint.

Never include secrets.
