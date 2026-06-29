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

Skill testing is **EDD**: each bundle may include `evals/*.json` cases (`input`, `expectedBehavior`, optional `assertions`). The Skill Engineer's `eval-skill` tool runs deterministic instruction-aligned checks in-process; full agent scoring runs locally via `npm run eval:skills` (requires `OPENAI_API_KEY`, not CI). Side-effecting tools honor **`testMode`** on Mastra `RequestContext` — when on, they return a declared mock and emit `skill.tool_invoked` with `mocked: true`.

Every skill touchpoint emits Job-correlated telemetry (`skill.activated`, `skill.tool_invoked`, `skill.validated`, `skill.changed`, `skill.activation_failed`).

### Progressive loading

The Engineering Lead (and Skill Engineer) use Mastra's auto-injected `skill` tool with `skillsFormat: "markdown"`. The agent sees a skill **index** in its prompt and loads full SOP bodies on demand — no eager concat of all skill bodies.

### Scope and permissions

Frontmatter `metadata.scope` is the source of truth (`shared` or `[agent-id, …]`). `resolveSkillsForAgent()` filters active skills by scope and authority; `validateSkill()` enforces `allowed-tools` ⊆ agent authority at validation time. Activation hooks on the Engineering Lead block out-of-scope loads and emit `skill.activation_failed`.

### Skill Engineer (Phase 6)

| Skill | Path | Scope | Role |
|-------|------|-------|------|
| `write-skill` | [write-skill/SKILL.md](./write-skill/SKILL.md) | `[skill-engineer]` | Meta-authoring SOP |
| `skill-eval-design` | [skill-eval-design/SKILL.md](./skill-eval-design/SKILL.md) | `[skill-engineer]` | EDD case design SOP |

Gateway: `npm run skill-gateway` (direct chat with the Skill Engineer). Lifecycle tools: `create-skill`, `edit-skill`, `validate-skill`, `eval-skill`, `deprecate-skill`, `archive-skill`, `request-tool-build`.

### Eval commands

| Command | When |
|---------|------|
| `npm run test` | CI — includes skill registry, permissions, telemetry, EDD plumbing, testMode fixture |
| `npm run eval:skills` | Local-only — progressive-loading recall, code-review verdict shape, testMode fixture buckets |

See [docs/phase-6-skill-platform.md](../docs/phase-6-skill-platform.md), [ADR 0009](../docs/adr/0009-mastra-agent-skills-substrate.md), and [ADR 0010](../docs/adr/0010-skill-permission-lifecycle.md).
