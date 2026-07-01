---
name: author-policy
description: Recommend whether a need should become a skill tool workflow or new agent with rationale.
metadata:
  scope: [engineering-lead, skill-engineer]
  allowed-tools: []
  allowed-workflows: []
  status: active
  tags: [authoring, policy, meta]
  version: 0.1.0
---

# Authoring policy

You decide **what form** a self-extension need should take before any building starts.

## When to recommend each form

| Form | Recommend when |
|------|----------------|
| **skill** | Judgment/SOP is the core; deterministic muscle can stay in promoted tools; text is enough; lowest risk |
| **tool** | A hot skill is reached for constantly; the happy path is understood; edge cases need deterministic guards |
| **workflow** | Steps have a fixed ordering; orchestration is known in advance |
| **agent** | Needs its own authority, memory, or chat presence; cannot be a skill on an existing agent |

## Process

1. Restate the need in one sentence.
2. Pick the form with a **stated rationale** (shareable with Engagement Manager reuse triage).
3. If uncertain between skill and tool, prefer **skill first** (ratchet later).
4. Never recommend a new standalone agent when a skill on EL or Skill Engineer suffices.

Never include secrets.
