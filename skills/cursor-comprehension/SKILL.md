---
name: cursor-comprehension
description: When to invoke read-only Cursor comprehension for multi-hop codebase reasoning (integration mapping, reuse discovery). Use Grep/registries first for cheap lookups.
metadata:
  scope: [engineering-lead, skill-engineer]
  allowed-tools:
    - comprehend
  status: active
  tags:
    - phase-6.5
    - comprehension
---

# Cursor comprehension (when to invoke)

Use the **comprehend** tool only for **judgment-heavy multi-hop** questions where cheap lookups are insufficient.

## Reach for comprehend when

- Mapping **where a change plugs in** across multiple modules (integration mapping).
- Deciding whether something **already exists** before building (reuse discovery).
- Tracing **what connects to what** when a single `Grep`/`Glob` is not enough.

## Do NOT use comprehend for

- Simple file/symbol lookups → `Grep`, `Glob`, or registries (`agentRegistry`, `skillRegistry`).
- Anything answerable from the PRD or a single file read.
- Writing or changing code (use plan-build / dispatch-slice instead).

## Output discipline

Comprehension output is **judgment** — always **cite paths and symbols**. The harness **verifies** citations deterministically. Treat unverified citations as advisory.
