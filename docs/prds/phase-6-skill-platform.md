# Objective

Ship Phase 6: the **Skill Platform** — skills become first-class, reusable system objects the system
can **discover, validate, load on demand, permission, observe, and compose**, with deterministic
muscle supplied by **Engineering-built, promoted Tools/Workflows** rather than code embedded in
skills, and **no `.ts` edits required to add or change a skill**. A new **Skill Engineer** (employee)
owns the skill lifecycle under a lighter validate-and-permission gate.

# Background

Through Phase 5, skills were hand-rolled `SKILL.md` files parsed by `src/skills/skillLoader.ts`, with
every body eagerly concatenated into the Engineering Lead's system prompt (hardcoded `SKILL_NAMES`).
A framework-first check found the installed Mastra (`@mastra/core@^1.46`) already implements the full
[Agent Skills spec](https://agentskills.io). Phase 6 **adopts Mastra Agent Skills behind a thin
`skillRegistry` wrapper** and builds only the domain gaps: authority/permission gating, Job-correlated
telemetry, the Skill Engineer agent, and skill EDD. See
[Phase 6 north star](../phase-6-skill-platform.md),
[grill notes](./phase-6-skill-platform.grill.md),
[ADR 0009](../adr/0009-mastra-agent-skills-substrate.md),
[ADR 0010](../adr/0010-skill-permission-lifecycle.md).

# Requirements

## ADRs + vocabulary (Slice 0)
- ADR 0009 (Mastra Agent Skills substrate) + ADR 0010 (skill permission/authority + lighter-gate
  lifecycle).
- `CONTEXT.md` nouns: **Skill** (update), **Skill bundle**, **Skill index**, **Skill scope**,
  **Progressive loading/activation**, **Skill Engineer**, **`skillRegistry`/`SkillRegistration`**,
  **Skill eval/EDD**, **Test mode/mock**.
- Naming: `skillRegistry` / `SkillRegistration` per `.cursor/rules/naming-conventions.mdc`.

## Substrate + migration (Slice 1)
- **`skillRegistry`** anti-corruption wrapper over Mastra Agent Skills (discovery, validation, scope
  projection). Retire `src/skills/skillLoader.ts` + `loadEngineeringSkillBodies()`.
- Migrate the 7 existing skills (`grill-me-with-docs`, `to-prd`, `research-write-tests`,
  `build-handoff`, `ship`, `code-review`, `security-review`) to discovered bundles with domain
  `metadata` (`scope`, `allowed-tools`, `status: active`, `tags`).
- **Progressive loading** on the Engineering Lead via Mastra's auto-injected `skill` /
  `skill_search` / `skill_read` tools; `skillsFormat: markdown`.
- **Migration regression eval** must be green before the eager concat is removed.

## Scope + permissions (Slice 2)
- Frontmatter **`scope`** (`shared` | `[agent-id, …]`) as single source of truth, projected onto
  `workspace.skills` / per-agent `Agent.skills`; `agentRegistry` becomes a derived, validated view.
- **`allowed-tools` / `allowed-workflows`** declared in `metadata`.
- **Authority rule:** a skill injects into an agent only if `allowed-tools` ⊆ agent authority;
  enforced at validation **and** injection. QA Engineer never receives authoring skills.
- Validation wrapper = Mastra `validateSkillMetadata` + scope/permission/authority + existence checks.

## Telemetry (Slice 3)
- `skillTelemetry` emits Job-correlated run-log JSONL: `skill.activated`, `skill.tool_invoked`
  (with `mocked` flag), `skill.validated`, `skill.changed`, `skill.activation_failed`. No secrets.

## Skill Engineer (Slice 4)
- `id: skill-engineer`, role "Skill Engineer", `kind: mastra-agent`, **`authority: employee`**,
  `standalone: true`, `directChat: true`; also invocable as an EL sub-agent.
- Tools: `create-skill`, `edit-skill`, `validate-skill`, `eval-skill`, `deprecate-skill`,
  `archive-skill`, `request-tool-build`.
- Authoring skills (`write-skill`, `skill-eval-design`) scoped **only** to it.
- **Lighter-gate lifecycle:** skill changes bypass the full QA pipeline (validate + permission-check +
  commit + telemetry). **Dangerous-tool carve-out:** declaring a new dangerous tool/workflow surfaces
  an operator acknowledgement (reuse Phase 5 permission-scan + approval-audit).
- **`request-tool-build`** creates a tracked Issue/backlog handoff to the Engineering Lead (not
  in-process delegation).

## EDD harness + test mode (Slice 5)
- `evals/` bundle convention; `eval-skill` tool; `npm run eval:skills` (local-only, real model,
  Mastra scorers).
- **`testMode`** flag propagated via `requestContext`; side-effecting tools return a declared mock and
  suppress the side effect when on; proven with a **test-only fixture tool**.

## North-star verification (Slice 6)
- `skills/README.md` updated; full eval matrix green locally; machinery + safety suites green in CI.

# Acceptance Criteria

- [ ] The 7 skills load via `skillRegistry`/Mastra with **progressive loading**; `skillLoader.ts` and
      the eager concat are removed.
- [ ] **Migration regression eval** is green (the engineering loop still works on-demand).
- [ ] Frontmatter `scope` drives injection: `shared` → all agents; agent-scoped → only named agents.
- [ ] **Authority invariant** holds: a skill whose `allowed-tools` exceed an agent's authority cannot
      be injected; the **QA-Engineer-never-gets-authoring** test passes.
- [ ] Validation flags bad name / over-long description / missing fields / missing declared tools, and
      passes a clean skill (no false positive).
- [ ] All five `skill.*` telemetry events are emitted with correct `session/job/trace` correlation;
      `skill.activation_failed` fires on an out-of-scope load attempt.
- [ ] The **Skill Engineer** can create/edit/validate/EDD-test/deprecate/archive a skill under the
      lighter gate; only its skill edits bypass QA (the agent itself shipped via full QA).
- [ ] A skill change declaring a **new dangerous tool** triggers operator acknowledgement; an ordinary
      edit does not.
- [ ] Skill Engineer **clearance**: employee cannot promote / use management-only tools.
- [ ] `request-tool-build` creates a tracked Issue routed to the Engineering Lead.
- [ ] **Test mode**: the fixture side-effecting tool returns its mock and suppresses the side effect
      under `testMode`, marking telemetry `mocked: true`.
- [ ] `npm run eval:skills` proves progressive-loading recall/precision, skill behavior, and authoring
      convergence locally; eval scripts documented.
- [ ] ADR 0009 + ADR 0010 + `CONTEXT.md` vocabulary committed; north-star doc + `skills/README.md`
      current.

# Technical Notes

- **Framework-first:** reuse Mastra Agent Skills (`workspace.skills` / `Agent.skills` / `createSkill`
  / `skill`*tools* / `validateSkillMetadata`) and Mastra **scorers** for EDD. Thin anti-corruption
  wrapper: `skillRegistry` / `SkillRegistration`. Do **not** execute a bundle's `scripts/` folder —
  deterministic muscle stays in promoted Tools.
- **Determinism ratchet:** skills = judgment (probabilistic); tools/workflows = deterministic muscle
  built by the Engineering Department and gated by Phase 5. Hardening a hot skill = extracting a tool.
- **Authority:** Skill Engineer is **employee**; `create/edit/validate/eval/deprecate/archive` are
  employee-safe; building new tools is management (EL) via the promotion loop.
- **Lighter gate vs QA:** skill changes are reviewable text → validate + permission + commit, not the
  full pipeline; dangerous-tool escalation reuses the Phase 5 permission-scan + approval-audit.
- **Naming:** `skillRegistry`/`SkillRegistration`, `skill-engineer`, `eval:skills`, `skillTelemetry`
  — all domain-qualified.
- **`skillsFormat: markdown`** for index injection.

# Out of Scope

Phase 7 / later: autonomous authoring agents (Skill Author / Tool Author / Hiring) + safe
self-activation; **"adapt from external skill"** (advanced `create-skill` over Mastra's `external`
source); **aggregate skill metrics / dashboards** (deferred but documented); **automated enforcement
that every side-effecting tool ships a mock + test** (Phase 7 Tool Author — documented there);
**Phase 4b** multi-agent chat + router/"ponytail" agent (planned shortly after Phase 6); skill search
tuning, external publishing, and versioning workflows beyond Mastra's defaults.

# Verification Commands

- `npm run typecheck`
- `npm run lint`
- `npm run test` (includes the deterministic machinery / safety / telemetry / migration / test-mode
  suites)
- `npm run eval:skills` (local-only, requires API keys) — progressive-loading recall/precision,
  skill behavior, authoring convergence
