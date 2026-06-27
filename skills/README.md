# Skills

MichaelOS skills are **focused instruction files** (Matt Pocock–style) that agents invoke for repeatable judgment work. Code handles deterministic steps; skills handle how to think.

## Phase 2 skills (Engineering Lead)

The **Engineering Lead** loads these from `skills/<name>/SKILL.md` via `src/skills/skillLoader.ts` and embeds them in agent instructions. The operator drives the loop through `npm run gateway`; tools persist deliverables to disk.

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

## Phase 6 (deferred)

YAML format, shared index, progressive loading, permissions, and script-backed skills remain out of scope until the Phase 2 loop is proven in production use.
