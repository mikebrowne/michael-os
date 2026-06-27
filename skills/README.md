# Skills

MichaelOS skills are **focused instruction files** (Matt Pocock–style) that agents invoke for repeatable judgment work. Code handles deterministic steps; skills handle how to think.

## Phase 2 minimal slice (in progress)

Phase 2 completion requires a **minimal skill system** — not the full YAML platform (Phase 6). For v1:

- Skills live as `SKILL.md` under `skills/<skill-name>/` (or adjacent to the owning agent).
- The **Engineering Lead** (first production agent) invokes skills in a checkpointed pipeline — new thread per step, deliverables on disk.
- Cursor’s inner loop may still use personal skills under `~/.cursor/skills/` (e.g. TDD); repo skills are for **Mastra orchestration**.

### Planned skills (Engineering Lead)

| Skill | Role | Deliverable |
|-------|------|-------------|
| `grill-me-with-docs` | Clarify requirements from chat or pasted context | Grill notes in `docs/prds/` |
| `to-prd` | Produce PRD + GitHub issue | PRD in `docs/prds/`; issue created/updated |
| `research-write-tests` | Define "done" before build | Test plan in PRD + one hash-locked acceptance test |
| `build-handoff` | Bundle PRD + acceptance test + issue → `agent:build` / Cursor | Build run + D+ report |

See [docs/phase-2-engineering-loop.md](../docs/phase-2-engineering-loop.md) for the full north star and grill decisions.

## Phase 6 (deferred)

YAML format, shared index, progressive loading, permissions, and script-backed skills remain out of scope until the Phase 2 loop is proven.
