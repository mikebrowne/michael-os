# Agent bundles

Agents in MichaelOS are **committed bundles** — the source of truth for each agent's job description and wiring. Adding or changing an agent requires **no `.ts` edits**; review the bundle in git, then activate after onboarding.

## Layout

```
agents/<id>/
  agent.md          # YAML frontmatter job description + optional markdown body
  skills/           # agent-scoped skills (optional)
  examples/         # optional
  evals/            # onboarding smoke-test cases (optional)
```

## Frontmatter fields

| Field | Description |
|-------|-------------|
| `id` | Must match directory name |
| `role` | Human-readable role name |
| `kind` | `mastra-agent` \| `external-executor` \| `skill` |
| `authority` | `management` \| `employee` |
| `description` | Short description for registry |
| `directChat` | Operator may chat directly |
| `standalone` | Appears as standalone agent |
| `status` | `active` \| `draft` \| `archived` |
| `skills` | Skill bundle names |
| `tools` | Tool ids |

## Derived view

[`agentRegistry`](../src/mastra/agentRegistry.ts) is a **derived, validated view** over discovered bundles (see [ADR 0014](../docs/adr/0014-agent-bundles-dynamic-registration.md)). Runtime registration reuses Mastra `addAgent`; controlled restart is the reliable baseline.

## Hiring + onboarding (Phase 7)

1. **Hiring** — EL `hire-agent` skill + `draft-agent-bundle` → proposal Issue → operator go-ahead
2. **Onboarding** — `onboard-agent-tool` runs smoke-test (probation)
3. **Activation** — logged operator yes via approval seam + `activate-agent` (may require restart)

Employee bundles **cannot** declare management-only tools (authority invariant).

Never commit secrets or private data in bundles.
