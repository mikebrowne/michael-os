---
name: skill-eval-design
description: Design EDD eval cases for a skill bundle (evals/ folder).
metadata:
  scope: [skill-engineer]
  allowed-tools: [eval-skill, validate-skill]
  allowed-workflows: []
  status: active
  tags: [authoring, eval, edd]
  version: 0.1.0
---

# Skill eval design

Design eval-driven development cases for a skill.

## Rules

- Each case lives in `skills/<name>/evals/*.json`.
- Shape: `{ "input": "...", "expectedBehavior": "..." }` plus optional assertions.
- Write the eval **first**, expect failure, then refine the SOP until `eval-skill` / `npm run eval:skills` passes.
- Evals run **local-only** with a real model — never in CI.
- Side-effecting tools must use `testMode` mocks during evals (see skill test mode contract).

Call `eval-skill` to run cases after authoring.
