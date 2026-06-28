# Objective

Define the decisions and scope for **Phase 6: Skill Platform** — *skills become first-class,
reusable system objects*. The north star: **a skill is a self-describing object the system can
discover, validate, load on demand, permission, observe, and compose** — where its deterministic
muscle comes from **Mastra tools/workflows built and promoted by the Engineering Department**, not
from code embedded in the skill — and **adding or changing a skill never requires editing `.ts`
files**.

Synthesized from the grill session on 2026-06-28. Builds on
[Phase 5](../phase-5-staging-review-promotion.md) (staging, QA Engineer gates, promotion) and the
determinism ratchet in [`CONTEXT.md`](../../CONTEXT.md).

**Pivotal framework-first finding:** the *installed* Mastra (`@mastra/core@^1.46`) already ships a
full **Agent Skills** system implementing the [Agent Skills spec](https://agentskills.io) —
`SKILL.md` bundles, frontmatter validation (`validateSkillMetadata` + `SKILL_LIMITS`), a skill
index (`workspace.skills.list/get/search` with vector/bm25/hybrid), progressive loading (auto-
injected `skill` / `skill_search` / `skill_read` tools), shared vs agent-specific scoping
(`workspace.skills` + per-agent `Agent.skills` with a dynamic resolver), inline skills
(`createSkill`), and versioning/publishing. Phase 6 therefore **adopts Mastra Agent Skills behind a
thin `skillRegistry` wrapper and builds only the domain gaps** (authority/permission gating,
Job-correlated telemetry, the Skill Engineer agent, and skill EDD). This is exactly the
framework-first rule's named example ("the full skill system → Mastra").

# Decisions

## North star & guiding principles

- **North star (above).** A skill = judgment SOP; it *orchestrates* by invoking Mastra **tools and
  workflows** (and other skills). Deterministic leaves (TS scripts, CLIs, MCPs) are **Tools/
  Workflows built by the Engineering Department** through the existing build → stage → verify →
  promote loop, so they are *safe by construction* (Phase 5 gates: permission scan, security
  review) before any skill can call them.
- **Determinism ratchet preserved:** judgment lives in skills; danger lives in tools (which keep
  full QA). "Hardening a skill" = extracting a tool the Engineering Lead builds and promotes.
- **Phase 6 / Phase 7 seam:** Phase 6 = the skill platform + an **operator-driven Skill Engineer**
  that authors/edits/tests skills. Phase 7 = **autonomous authoring agents** (Skill Author, Tool
  Author, Hiring) + safe self-activation.

## D1 — Adopt Mastra Agent Skills as the substrate (framework-first)

- **Reuse** Mastra's skills system; **retire** the hand-rolled `src/skills/skillLoader.ts` and the
  eager full-body concat in `engineering-lead.ts`.
- Wrap Mastra in a thin **`skillRegistry`** / **`SkillRegistration`** anti-corruption layer (domain
  nouns on top; framework churn becomes a localized edit).
- **ADR 0009** records this build-vs-reuse decision + alternatives.

## D2 — Skill format & bundle structure

- **`SKILL.md` = markdown SOP body + YAML frontmatter** (Agent Skills spec). *Not* a YAML body.
  "YAML skill format" (the init.md story) = **richer, validated YAML frontmatter**.
- A skill is a **directory bundle**: `skills/<name>/SKILL.md` plus optional `references/`,
  `examples/`, and `evals/` subfolders. Reference material is disclosed **on demand** (progressive),
  never crammed into the index.
- **Frontmatter** uses the spec fields (`name`, `description`, `license?`, `compatibility?`,
  `user-invocable?`) and carries our domain fields inside the spec's arbitrary **`metadata`** map
  (spec-compliant): `scope`, `allowed-tools`, `allowed-workflows`, `tags`/`category`, `status`
  (`active` / `draft` / `deprecated`), `version`.
- **`scripts/` bundle folder is NOT executed** — deterministic muscle stays in promoted Tools, not
  loose scripts in a skill. (If present, `scripts/` is read-only reference only.)

## D3 — Scope & permission model

- **Two native Mastra scoping levels, merged:** **shared** skills on `workspace.skills` (all
  agents); **agent-specific** skills on per-agent `Agent.skills` (static or dynamic resolver keyed
  off `requestContext`); agent-level wins on name conflicts.
- **Single source of truth = frontmatter `scope`** (`shared` or `[agent-id, …]`), **projected**
  onto Mastra by `skillRegistry`. `agentRegistry.ts` becomes a *derived, validated view* (not the
  authority).
- **Authority rule (the core safety invariant):** a skill is only injected into an agent if the
  agent's authority covers **every** tool in the skill's `allowed-tools`. A skill touching a
  `management`-only dangerous tool can **never** be injected into an `employee` agent — validation
  fails loudly. (Concrete check: the QA Engineer never receives skill-authoring skills.)
- **ADR 0010** records the permission model + the lighter-gate lifecycle (D5).

## D4 — Skill telemetry (observability expands with capability)

- Thin domain layer over Mastra observability: a `skillTelemetry` helper emits structured run-log
  JSONL events (correlated by existing `sessionId` / `jobId` / `traceId`), never secrets:
  - **`skill.activated`** — agent loaded a skill via the `skill` tool (progressive-loading signal).
  - **`skill.tool_invoked`** — a skill caused a tool/workflow call (judgment → deterministic
    handoff); carries `mocked: true` when test mode suppressed a side effect (D8).
  - **`skill.validated`** — validation ran (pass/fail + errors/warnings).
  - **`skill.changed`** — Skill Engineer created/edited/deprecated/archived a skill (the lifecycle
    audit trail that substitutes for the QA pipeline).
  - **`skill.activation_failed`** — an agent attempted to load a skill outside its scope/authority
    (security-relevant).
- **Aggregate metrics deferred but documented** — per-skill activation counts / last-used feed the
  determinism ratchet ("this skill is hot, consider hardening it into a tool"); a trivial later pass
  over the JSONL. Captured intentionally so it is not lost.

## D5 — Skill lifecycle: lighter gate, not the full QA pipeline

- **Skill changes bypass the full QA/promotion pipeline** (which is for executable code). A skill is
  reviewable **English text**; its only real-world effect is the tools it invokes, which are already
  gated. The lighter gate that *replaces* full QA for skills:
  - **Skill validation** (frontmatter schema valid, body present, declared tools/workflows exist),
    **plus**
  - **Permission/scope check** (`allowed-tools` ⊆ authority; scope well-formed), **plus**
  - **"it's just text" reversibility** (committed to git, revertable, telemetry on every change).
- **Dangerous-tool carve-out:** if a skill change **declares a new dangerous tool/workflow**, that
  still surfaces an **operator acknowledgement**, reusing Phase 5's permission-scan + approval-audit
  machinery. The bypass covers ordinary edits, **not** capability escalation.

## D6 — The Skill Engineer agent

- New department agent: `id: skill-engineer`, role **"Skill Engineer"**, `kind: mastra-agent`,
  **`authority: employee`**, `standalone: true`, `directChat: true` (exercisable directly via the
  gateway *before* Phase 4b's multi-agent chat exists) and invocable as an EL **sub-agent**. Keeps
  Phase 6 independent of Phase 4b.
- **Tools (all employee-safe):** `create-skill`, `edit-skill`, `validate-skill` (wraps Mastra
  `validateSkillMetadata` + our permission/scope checks), `eval-skill` (runs the bundle's `evals/`),
  `deprecate-skill` (`status: deprecated`, stays visible), `archive-skill` (pull out of the active
  set, retained for restore), `request-tool-build`.
- **Its skills (scoped only to it):** `write-skill` (Matt-Pocock-style meta-skill for authoring) and
  `skill-eval-design` (how to design EDD cases). The QA Engineer never receives these.
- **`request-tool-build`** = a **tracked Issue/backlog handoff** to the Engineering Lead (not
  in-process upward delegation). The EL (management) runs the full build → QA → promote loop for the
  new tool.
- **Self-consistency:** adding the Skill Engineer *agent* is a code change → it goes through the
  normal engineering QA pipeline. Only the **skill edits it later makes** ride the lighter gate.
- **Discovery tools:** rely on Mastra's auto-injected `skill_search` / `skill_read` rather than
  bespoke list/read tools.

## D7 — Skill testing via EDD (eval-driven development)

- Each skill bundle gets an optional **`evals/`** folder of cases (`{ input scenario, expected
  behavior / assertions }`).
- `eval-skill` + **`npm run eval:skills`** run the cases, scored by **Mastra scorers**
  (`MastraScorers` — LLM-as-judge for judgment, deterministic assertions for structured output).
  **Local-only, real model** (pattern of `eval:promotion` / `eval:gates`).
- **EDD discipline:** when authoring/editing a skill, write/update an eval case first, watch it
  fail, then write the SOP until it passes — the same red/green ratchet used for code.

## D8 — Tool "test mode" / mock contract (eval isolation)

- Running a skill eval must **not** cause real side effects (e.g. a CRM "create contact").
- The eval harness **propagates a `testMode` flag** through Mastra's `requestContext`. When on, any
  **side-effecting** tool (external write, message-send) MUST **return a declared mock/fixture
  instead of performing the side effect**, and emit `skill.tool_invoked` with `mocked: true`.
- The mock is part of the **tool** (deterministic, reviewed), never invented by the skill/LLM.
- **Phase 6 scope:** establish the `testMode` context channel + the documented mock contract + wire
  it into `eval-skill`, proven end-to-end with a **test-only fixture tool** in the suite.
  **Automated enforcement** ("every side-effecting tool declares a mock + test") is **deferred to
  Phase 7 (Tool Author)** and must be **documented there so it is caught**.

## D9 — Migration

- **Migrate all 7 existing skills at once** (no backward-compat shim — single operator, fully
  reversible via git): `grill-me-with-docs`, `to-prd`, `research-write-tests`, `build-handoff`,
  `ship`, `code-review`, `security-review`. Add domain `metadata` (`scope`, `allowed-tools`,
  `status: active`, `tags`); discover via Mastra.
- **Retire** `src/skills/skillLoader.ts` + `loadEngineeringSkillBodies()`; the EL now sees the
  **index** and loads bodies **on demand** via the `skill` tool.
- **`skillsFormat: markdown`** for index injection (consistent, eyeball-able in traces).
- **Riskiest step → pinned by a test:** a **migration regression eval** must go **green** to prove
  the existing engineering loop still works under progressive loading before the eager loader is
  removed.

## D10 — Documentation artifacts

- **ADR 0009** — Adopt Mastra Agent Skills as the skill substrate.
- **ADR 0010** — Skill permission/authority model & lighter-gate lifecycle.
- Skill Engineer agent, EDD/test-mode, and telemetry documented in the **north-star phase doc** (no
  separate ADRs), mirroring how Phase 5 kept restart operational in its north-star doc.
- New `CONTEXT.md` nouns: **Skill** (updated), **Skill bundle**, **Skill index**, **Skill scope**,
  **Progressive loading / activation**, **Skill Engineer**, **`skillRegistry` / `SkillRegistration`**,
  **Skill eval / EDD**, **Test mode / mock**.

## D11 — Delivery slices (prove the substrate first, then layer)

0. **Chore:** ADR 0009 + 0010; `CONTEXT.md` vocabulary; `init.md` Phase 6 refinement; naming.
1. **Substrate + migration:** `skillRegistry` over Mastra Agent Skills; migrate the 7 skills; retire
   `skillLoader.ts` + eager concat; progressive loading on the EL; **migration regression eval**.
2. **Scope + permissions:** frontmatter `scope` + `allowed-tools`/`allowed-workflows` projection;
   validation wrapper; **authority-enforcement invariant** + QA-never-gets-authoring CI tests.
3. **Telemetry:** the five `skill.*` events correlated to Jobs/run-logs.
4. **Skill Engineer:** the agent + its tools + lighter-gate lifecycle + dangerous-tool carve-out
   (reuse Phase 5 permission-scan/approval-audit) + `request-tool-build` handoff.
5. **EDD harness:** `evals/` convention, `eval-skill`, `npm run eval:skills`, `testMode` channel +
   fixture tool; judgment evals.
6. **North-star verification:** docs + `skills/README` + wrap.

## D12 — Evals & tests

**Deterministic (CI, no secrets, no model):**
- `skillRegistry` discovery builds the index + de-dupes.
- Validation: Mastra `validateSkillMetadata` wrapper — per-rule failures (bad name, over-long
  description, missing fields) + scope/permission checks + a **clean-skill negative**.
- **Authority-enforcement invariant** (core safety property): a skill whose `allowed-tools` exceed an
  agent's authority **cannot** be injected — plus the concrete **QA-Engineer-never-gets-authoring**
  test.
- Scope projection: `shared` → all agents; agent-scoped → only the named agents.
- Telemetry: all five events emitted with correct `session/job/trace` correlation;
  `skill.activation_failed` on an out-of-scope load attempt.
- Lighter-gate policy: ordinary edit ships without QA; a change declaring a **new dangerous tool**
  triggers operator acknowledgement.
- Skill Engineer **clearance**: employee cannot promote / use management-only tools.
- **Migration regression** (D9): existing skills still load; EL works under progressive loading.
- **Test-mode** (D8): a fixture side-effecting tool returns its mock and is suppressed under
  `testMode`, with `mocked: true` in telemetry.

**Judgment evals (local-only, real model) — `npm run eval:skills`:**
- **Progressive-loading recall/precision** — the agent discovers + activates the *right* skill via
  `skill_search`/`skill` and does **not** over-activate irrelevant ones (precision threshold, à la
  Phase 5 gate precision).
- **Skill-behavior eval** — a representative skill (e.g. `code-review`) produces the expected verdict
  shape on seeded input.
- **Authoring convergence** — given a small spec, the Skill Engineer produces a skill that passes
  validation + its own basic eval (meta-eval that the EDD loop works).

# Open questions resolved

- North-star framing → discover / validate / load-on-demand / permission / observe / compose; muscle
  = engineering-built promoted tools; no `.ts` edits to add a skill. **Yes.**
- Build vs reuse → **adopt Mastra Agent Skills** behind a thin `skillRegistry`; retire the
  hand-rolled loader + eager concat.
- Format → **`SKILL.md` markdown + YAML frontmatter** (Agent Skills spec); directory bundle with
  `references/` / `examples/` / `evals/`; domain fields ride in `metadata`; `scripts/` not executed.
- Frontmatter additions → `scope`, `allowed-tools`, `allowed-workflows`, `tags`/`category`,
  `status`, `version`.
- Scope → **two-level (workspace shared + per-agent)**, driven by frontmatter `scope`, projected by
  `skillRegistry`; `agentRegistry` is a derived view.
- Permissions → **`allowed-tools` ⊆ agent authority**, enforced at validation + injection.
- Telemetry → **five `skill.*` events** correlated to Jobs/run-logs; aggregate metrics deferred but
  documented.
- Lifecycle → skill changes **bypass full QA** via validate + permission-check + commit; **dangerous-
  tool carve-out** still requires operator ack.
- Agent → **Skill Engineer** (`skill-engineer`, employee, standalone + directChat); tools
  create/edit/validate/eval/deprecate/archive/request-tool-build; authoring skills scoped only to it.
- Tool requests → **tracked Issue/backlog handoff** to the EL (not in-process delegation).
- Skill testing → **EDD** with `evals/` + **Mastra scorers** + `npm run eval:skills` (local-only).
- Eval isolation → **tool `testMode`/mock contract** via `requestContext`; Phase 6 builds the channel
  + contract + fixture; full enforcement → Phase 7.
- Migration → **all 7 at once**, retire `skillLoader.ts`, `skillsFormat: markdown`, guarded by a
  **migration regression eval** that must be green.
- Docs → **ADR 0009 + ADR 0010**; Skill Engineer/EDD/telemetry in the north-star doc; `CONTEXT.md`
  vocabulary.
- Issues → extend the existing **`[BL-008]` / #6** epic and create slice issues `BL-008a..g`.

# Out of scope (→ Phase 7 / later)

- **Autonomous authoring agents** (Skill Author writing skills proactively, Tool Author, Hiring) +
  safe self-activation — Phase 7.
- **"Adapt from external skill"** (give a link/reference → adapt an external skill into our system) —
  an advanced `create-skill`; maps to Mastra's `external` source + `publishSkillFromSource`. Later.
- **Aggregate skill metrics / usage dashboards** — deferred but documented (D4); trivial later pass
  over the JSONL.
- **Automated enforcement that every side-effecting tool declares a mock + test** — Phase 7 (Tool
  Author); must be documented there so it is caught.
- **Phase 4b** (multi-agent chat interface + router/"ponytail" agent, to be renamed) — planned
  shortly *after* Phase 6, partly to interactively exercise the Skill Engineer and the router. Phase
  6 must not hard-depend on it.
- Vector/hybrid skill **search tuning**, skill **publishing to external packages**, and skill
  **versioning workflows** beyond what Mastra provides out of the box.
