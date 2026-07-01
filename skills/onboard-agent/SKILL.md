---
name: onboard-agent
description: Wire a hired agent starter skills memory registration and run its onboarding smoke-test.
metadata:
  scope: [engineering-lead]
  allowed-tools: [onboard-agent-tool, activate-agent, request-activation, restart]
  allowed-workflows: []
  status: active
  tags: [authoring, onboarding]
  version: 0.1.0
---

# Onboard agent

**Onboarding** = get the hire working and pass probation before activation.

## Process

1. Call `onboard-agent-tool` with the agent id — wires registration and runs the **onboarding smoke-test**.
2. The smoke-test **must pass** before activation (prove-before-activation).
3. On pass, call `request-activation` then `activate-agent` (may require controlled restart).
4. Employee bundles cannot hold management-only tools — validation blocks this structurally.

A hired agent only goes live after passing probation and a logged operator yes.

Never include secrets.
