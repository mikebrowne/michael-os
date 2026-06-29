# Skills

MichaelOS skills are **focused instruction files** (Matt Pocock–style) that agents invoke for repeatable judgment work. Code handles deterministic steps; skills handle how to think.

## Phase 2 skills (Engineering Lead)

The **Engineering Lead** discovers these via `src/skills/skillRegistry.ts` over Mastra Agent Skills and loads bodies **on demand** (progressive loading via the `skill` tool). The operator drives the loop through `npm run gateway`; tools persist deliverables to disk.

| Skill | Path | Role | Deliverable |
|-------|------|------|-------------|
| `grill-me-with-docs` | [grill-me-with-docs/SKILL.md](./grill-me-with-docs/SKILL.md) | Clarify requirements from chat or pasted context | Grill notes in `docs/prds/<slug>.grill.md` |
| `to-prd` | [to-prd/SKILL.md](./to-prd/SKILL.md) | Produce PRD + GitHub issue | `docs/prds/<slug>.md`; issue created/updated |
| `research-write-tests` | [research-write-tests/SKILL.md](./research-write-tests/SKILL.md) | Define "done" before build | Test plan in PRD + one hash-locked acceptance test |
| `build-handoff` | [build-handoff/SKILL.md](./build-handoff/SKILL.md) | Bundle PRD + acceptance test → `runAgentBuild` | Build run + D+ report in chat |
| `ship` | [ship/SKILL.md](./ship/SKILL.md) | Commit planning docs or green implementation | `ship-docs` / `ship-implementation` tools |

## Phase 3 skills (Code Reviewer)

| Skill | Path | Agent | Deliverable |
|-------|------|-------|-------------|
| `code-review` | [code-review/SKILL.md](./code-review/SKILL.md) | Code Reviewer | Advisory verdict (`approve` / `request-changes` / `block`) via `review-build` |

Department roster is defined in `src/mastra/agentRegistry.ts`. See [docs/phase-3-engineering-department.md](../docs/phase-3-engineering-department.md).

See [docs/phase-2-engineering-loop.md](../docs/phase-2-engineering-loop.md) for the full north star and grill decisions.

## Phase 6 — Skill Platform

Skills become **first-class objects** on top of **Mastra Agent Skills** ([spec](https://agentskills.io)), wrapped by `src/skills/skillRegistry.ts` (which replaces the hand-rolled `skillLoader.ts` + eager prompt concat). A skill is a `SKILL.md` **bundle** (frontmatter + SOP body, optional `references/` / `examples/` / `evals/`); bodies load **on demand** (progressive loading), not all-at-once.

Frontmatter domain fields ride in the spec's `metadata` map:

- `scope` — `shared` or `[agent-id, …]` (single source of truth, projected onto Mastra).
- `allowed-tools` / `allowed-workflows` — must be ⊆ the agent's authority (enforced at validation + injection).
- `tags` / `category`, `status` (`active` / `draft` / `deprecated`), `version`.

The **Skill Engineer** (`skill-engineer`, employee) authors/edits/validates/EDD-tests skills under a **lighter gate** (validate + permission-check + commit) that bypasses the full QA pipeline; declaring a *new dangerous tool* still requires operator acknowledgement. Deterministic muscle (TS scripts, CLIs, MCPs) is built as **Tools/Workflows by the Engineering Lead** via the promotion loop — never embedded in a skill (a bundle's `scripts/` folder is not executed).

Skill testing is **EDD**: `evals/` cases scored by Mastra scorers via `npm run eval:skills` (local-only). Every skill touchpoint emits Job-correlated telemetry (`skill.activated`, `skill.tool_invoked`, `skill.validated`, `skill.changed`, `skill.activation_failed`).

See [docs/phase-6-skill-platform.md](../docs/phase-6-skill-platform.md), [ADR 0009](../docs/adr/0009-mastra-agent-skills-substrate.md), and [ADR 0010](../docs/adr/0010-skill-permission-lifecycle.md).
