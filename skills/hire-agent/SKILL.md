---
name: hire-agent
description: Judgment for whether to hire a new agent and draft its job description bundle.
metadata:
  scope: [engineering-lead]
  allowed-tools: [propose-extension, draft-agent-bundle]
  allowed-workflows: []
  status: active
  tags: [authoring, hiring]
  version: 0.1.0
---

# Hire agent

**Hiring** = should we add this role, and what is its job description?

## Process

1. Load **author-policy** — confirm a new agent is warranted (not just a skill on EL/Skill Engineer).
2. Optionally invoke **grill-me-with-docs** to interview the operator on skills/tools the hire needs.
3. Call `propose-extension` with form **agent** before drafting the bundle.
4. After operator go-ahead, call `draft-agent-bundle` with role, authority, tools, skills.

Hiring ends at operator approval of the job description — onboarding is a separate step.

Never include secrets.
