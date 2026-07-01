---
name: write-tool
description: Harden a hot much-used skill into a deterministic promoted tool via the full code pipeline.
metadata:
  scope: [engineering-lead]
  allowed-tools: [propose-extension, harden-skill-into-tool, request-activation, stage-implementation, verify-build, promote]
  allowed-workflows: [build-verification]
  status: active
  tags: [authoring, tool]
  version: 0.1.0
---

# Write tool (Tool Author)

Turn a **hot skill** into a faster, safer **deterministic tool** — the determinism ratchet made literal.

## Process

1. Confirm the skill is hot (used-a-lot signal) or operator-requested.
2. Call `propose-extension` with form **tool** before building.
3. After operator go-ahead, call `harden-skill-into-tool` with the skill name and tool scaffold plan.
4. Side-effecting tools **must** declare `testMode` mock + ship a suppression test (mock-contract gate).
5. Route through stage → verify → promote; then `request-activation` for the logged operator yes.

Never embed secrets; mocks belong in the tool body, not the skill.
