# Phase 6: Skill Platform (north star)

Skills become **first-class, reusable system objects**. This is the phase where the determinism
ratchet from `CONTEXT.md` gets real infrastructure: judgment is packaged as discoverable, validated,
permissioned, observable skills, and the deterministic muscle they call is built — safely — by the
Engineering Department.

## Guiding principle

A **skill** is a judgment SOP (English) that *orchestrates*; it invokes **Mastra tools and
workflows** (and other skills) to act. Deterministic leaves — TS scripts, CLIs, MCPs — are **Tools/
Workflows built and promoted by the Engineering Department** (Phase 5 loop), never code embedded in a
skill. Danger lives in tools (which keep full QA); judgment lives in skills (which iterate fast). The
boundary moves outward as understanding grows: a "hot" skill gets hardened by *extracting* a tool the
Engineering Lead builds and promotes.

## North star user story

> A skill is a self-describing object the system can **discover, validate, load on demand,
> permission, observe, and compose** — and **adding or changing a skill never requires editing
> `.ts` files**. A new **Skill Engineer** (employee) authors, edits, validates, and EDD-tests
> skills; when a skill needs new deterministic muscle, the Skill Engineer files a tracked request and
> the Engineering Lead builds the tool through the normal promotion loop.

## Core principle: framework-first

The installed Mastra (`@mastra/core@^1.46`) already ships a full **Agent Skills** system
([spec](https://agentskills.io)). Phase 6 **reuses** it behind a thin `skillRegistry` wrapper and
builds only the domain gaps. See [ADR 0009](./adr/0009-mastra-agent-skills-substrate.md).

| Capability | Mastra provides | MichaelOS adds (our domain) |
|---|---|---|
| YAML skill format | `SKILL.md` + frontmatter (Agent Skills spec) | domain fields in `metadata` (`scope`, `allowed-tools`, `tags`, `status`) |
| Validation | `validateSkillMetadata` + `SKILL_LIMITS` | scope/permission/authority checks |
| Skill index | `workspace.skills.list/get/search` (vector/bm25/hybrid) | `skillRegistry` projection + derived `agentRegistry` view |
| Progressive loading | auto-injected `skill` / `skill_search` / `skill_read` tools | replace eager prompt concat; `skillsFormat: markdown` |
| Shared vs agent-specific | `workspace.skills` + per-agent `Agent.skills` resolver | `scope` as single source of truth, projected |
| Script-backed / bundles | `references/` / `scripts/` / `assets/`, versioning, publishing | `scripts/` **not executed** — muscle = promoted tools |
| Telemetry | own observability/scorers | Job-correlated `skill.*` run-log events |
| Authoring | `createSkill` | the **Skill Engineer** agent + lighter-gate lifecycle |

## Architecture

- **`skillRegistry` / `SkillRegistration`** — thin anti-corruption wrapper over Mastra Agent Skills.
  Discovers `skills/**/SKILL.md`, validates, reads frontmatter `scope`/`allowed-tools`, and
  **projects** each skill onto Mastra: `shared` → `workspace.skills`; agent-scoped → that agent's
  `Agent.skills`. Single source of truth for *which agent sees which skill*.
- **Skill bundle** — `skills/<name>/SKILL.md` (frontmatter + SOP body) plus optional `references/`,
  `examples/`, `evals/`. Body + references load **on demand** (progressive); only `name` +
  `description` sit in the always-present index.
- **Progressive loading** — agents receive the index and call Mastra's `skill` tool to load a body
  when relevant; `skill_search` / `skill_read` reach deeper material. The Engineering Lead's eager
  `loadEngineeringSkillBodies()` concat is **retired**.
- **Permission model** — `allowed-tools` ⊆ agent authority, enforced at validation *and* injection.
  See [ADR 0010](./adr/0010-skill-permission-lifecycle.md).
- **Skill Engineer** — employee agent owning the skill lifecycle; deterministic-tool needs are
  handed to the Engineering Lead as tracked Issues.
- **Telemetry** — `skillTelemetry` emits Job-correlated JSONL on activation, tool-invocation,
  validation, change, and activation-failure.

## The nouns

- **Skill** — a judgment SOP (`SKILL.md` bundle) that orchestrates tools/workflows/skills.
- **Skill bundle** — the skill directory (`SKILL.md` + `references/` / `examples/` / `evals/`).
- **Skill index** — name + description of every discovered skill, always present; bodies load on
  demand (progressive loading / **activation**).
- **Skill scope** — a skill's declared audience (`shared` or `[agent-id, …]`), the source of truth
  projected by `skillRegistry`.
- **`skillRegistry` / `SkillRegistration`** — the anti-corruption wrapper + per-skill record.
- **Skill Engineer** — the employee agent that authors/edits/validates/EDD-tests skills.
- **Skill eval / EDD** — eval-driven development of a skill via its `evals/` cases + Mastra scorers.
- **Test mode / mock** — a `requestContext` flag that makes side-effecting tools return declared
  mocks (no real side effects) during evals.

## Decisions (grill session 2026-06-28)

Full record in [grill notes](./prds/phase-6-skill-platform.grill.md). Headlines:

- **D1** Adopt Mastra Agent Skills; retire `skillLoader.ts` + eager concat (ADR 0009).
- **D2** `SKILL.md` markdown + YAML frontmatter; directory bundle; domain fields in `metadata`;
  `scripts/` not executed.
- **D3** Two-level scope (workspace + per-agent), frontmatter `scope` source of truth; **authority
  rule** `allowed-tools` ⊆ agent authority (ADR 0010).
- **D4** Five Job-correlated `skill.*` telemetry events; aggregate metrics deferred (documented).
- **D5** Skill changes **bypass full QA** via validate + permission-check + commit; **dangerous-tool
  carve-out** requires operator ack.
- **D6** **Skill Engineer** employee agent (standalone + directChat); tools create/edit/validate/
  eval/deprecate/archive/request-tool-build; authoring skills scoped only to it.
- **D7** Skill testing = **EDD** (`evals/` + Mastra scorers + `npm run eval:skills`, local-only).
- **D8** Tool **`testMode`/mock contract** for eval isolation; full enforcement → Phase 7.
- **D9** Migrate all 7 skills at once; `skillsFormat: markdown`; guarded by a **migration regression
  eval**.

## Lifecycle: lighter gate for skills (not the full QA pipeline)

A skill is reviewable text whose danger is delegated to already-gated tools, so a skill change does
**not** go through the Phase 5 promotion pipeline. It passes a **lighter gate**: (1) validation
(schema + declared tools/workflows exist), (2) permission/scope check (`allowed-tools` ⊆ authority),
(3) commit + `skill.changed` telemetry (trivially revertable). **Carve-out:** a change that declares
a *new dangerous tool/workflow* still surfaces an operator acknowledgement (reusing Phase 5
permission-scan + approval-audit). Adding the Skill Engineer *agent* is code → full QA; only its
later skill edits ride the lighter gate.

## Testing the north star (honoring zero-secret CI)

### A. Deterministic machinery tests (CI, no secrets)

- `skillRegistry` discovery builds the index + de-dupes alias paths.
- Validation wrapper: per-rule failures (bad name, over-long description, missing fields) +
  scope/permission checks + a clean-skill negative.
- Scope projection: `shared` → all agents; agent-scoped → only the named agents.
- Migration regression: existing skills still load; the Engineering Lead works under progressive
  loading (no eager concat).

### B. Safety / security tests (CI, no secrets)

- **Authority-enforcement invariant**: a skill whose `allowed-tools` exceed an agent's authority
  cannot be injected — plus the concrete **QA-Engineer-never-gets-authoring** test.
- Lighter-gate policy: ordinary edit ships without QA; a change declaring a new dangerous tool
  triggers operator acknowledgement.
- Skill Engineer **clearance**: employee cannot promote / use management-only tools.
- Telemetry: all five `skill.*` events emitted with correct `session/job/trace` correlation;
  `skill.activation_failed` on an out-of-scope load attempt.
- **Test mode**: a fixture side-effecting tool returns its mock under `testMode` and the side effect
  is suppressed, with `mocked: true` in telemetry.

### C. Judgment evals (local-only, real model — never in CI) — `npm run eval:skills`

- **Progressive-loading recall/precision**: the agent activates the *right* skill via
  `skill_search`/`skill` and does not over-activate irrelevant ones (precision threshold).
- **Skill-behavior eval**: a representative skill (e.g. `code-review`) produces the expected verdict
  shape on seeded input.
- **Authoring convergence**: given a small spec, the Skill Engineer produces a skill that passes
  validation + its own basic eval (the EDD loop works).

## Delivery slices (thin vertical, ordered)

### Slice 0 (chore) — ADRs + vocabulary
ADR 0009 + 0010; `CONTEXT.md` nouns; `init.md` Phase 6 refinement; naming (`skillRegistry` /
`SkillRegistration`).

### Slice 1 — Substrate + migration (the loop)
`skillRegistry` over Mastra Agent Skills; migrate the 7 skills; retire `skillLoader.ts` + eager
concat; progressive loading on the Engineering Lead; **migration regression eval** green.

### Slice 2 — Scope + permissions
Frontmatter `scope` + `allowed-tools`/`allowed-workflows` projection; validation wrapper; authority-
enforcement invariant + QA-never-gets-authoring tests.

### Slice 3 — Telemetry
The five `skill.*` events correlated to Jobs/run-logs.

### Slice 4 — Skill Engineer
The agent + its tools + lighter-gate lifecycle + dangerous-tool carve-out (reuse Phase 5 permission-
scan/approval-audit) + `request-tool-build` Issue handoff.

### Slice 5 — EDD harness
`evals/` convention; `eval-skill`; `npm run eval:skills`; `testMode` channel + fixture tool; judgment
evals.

### Slice 6 — North-star verification
Docs + `skills/README` + wrap; full eval matrix green locally, machinery/safety suites green in CI.

## In scope (Phase 6)

- Mastra Agent Skills adoption + `skillRegistry`; migration of the 7 existing skills.
- Bundle format + frontmatter schema (domain fields in `metadata`).
- Scope + permission/authority enforcement (ADR 0010).
- Five `skill.*` telemetry events.
- The Skill Engineer agent + lighter-gate lifecycle + `request-tool-build`.
- Skill EDD (`evals/` + scorers + `npm run eval:skills`) + the `testMode`/mock channel + fixture.

## Out of scope (→ Phase 7 / later)

- Autonomous authoring agents (Skill Author proactively writing skills, Tool Author, Hiring) + safe
  self-activation — **Phase 7**.
- **"Adapt from external skill"** (link/reference → adapted skill) — advanced `create-skill`; maps to
  Mastra `external` source + `publishSkillFromSource`. Later.
- **Aggregate skill metrics / usage dashboards** — deferred but documented; a trivial later pass over
  the JSONL (feeds the determinism ratchet).
- **Automated enforcement that every side-effecting tool declares a mock + test** — **Phase 7 (Tool
  Author)**; documented there so it is caught.
- **Phase 4b** (multi-agent chat interface + the **Engagement Manager** coordinator — the rename of the
  old "Ponytail" necessity reviewer) — planned shortly *after* Phase 6 (and after Phase 6.5) to
  interactively exercise the Skill Engineer and the router; Phase 6 must not hard-depend on it.
- Skill search tuning, external publishing, and versioning workflows beyond Mastra's defaults.

## Phase 6 complete when

- The 7 skills load via `skillRegistry`/Mastra with **progressive loading**; `skillLoader.ts` and the
  eager concat are gone; the migration regression eval is green.
- Frontmatter `scope` + `allowed-tools` drive injection; the **authority invariant** and
  **QA-never-gets-authoring** tests pass.
- The five `skill.*` telemetry events are emitted and correlated.
- The **Skill Engineer** can author/edit/validate/EDD-test a skill under the lighter gate, with the
  dangerous-tool carve-out enforced, and can file a `request-tool-build` Issue.
- `npm run eval:skills` proves progressive-loading recall/precision, skill behavior, and authoring
  convergence locally; CI machinery + safety suites are green with zero secrets.
- ADR 0009 + 0010 + `CONTEXT.md` vocabulary committed; `skills/README.md` updated.

## Related

- [Phase 5 north star](./phase-5-staging-review-promotion.md) — the promotion loop that builds tools.
- [ADR 0009](./adr/0009-mastra-agent-skills-substrate.md), [ADR 0010](./adr/0010-skill-permission-lifecycle.md)
- [Grill notes](./prds/phase-6-skill-platform.grill.md), [PRD](./prds/phase-6-skill-platform.md)
- [`CONTEXT.md`](../CONTEXT.md) — domain glossary + determinism ratchet.
