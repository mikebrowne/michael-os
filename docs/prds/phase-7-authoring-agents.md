# Objective

Ship Phase 7: **Authoring Agents** — *the system can safely extend itself*. MichaelOS can **notice or
be asked**, **propose** new skills / tools / workflows / agents as reviewable backlog Issues, **draft**
them (each with its own passing test/eval), and bring them **live only behind an explicit, logged
operator activation**, reusing the existing per-type safety rails. Autonomy posture is **B — "notices
and proposes"**; activation stays human. The *judgment* of when/whether/how to extend the system lives
in **editable markdown skills**; the *muscle* lives in deterministic tools.

# Background

Phase 6 made judgment first-class (Mastra Agent Skills behind `skillRegistry`) and shipped the
**operator-driven** Skill Engineer; Phase 6.5 made the build loop **steerable and observable** from the
gateway. Phase 7 adds **initiative**: the system may propose and draft extensions of itself. A
framework-first check found the installed Mastra (`@mastra/core@^1.46`, `mastra@^1.15`) already exposes
`Mastra.addAgent(...)` (register an agent into a **running** instance) and **Stored Agents** /
`MastraEditor` (config-defined agents with dependency resolution + versioning). Phase 7 therefore
**reuses that loader behind a thin wrapper** and builds only the domain gaps: the authoring-policy +
proposal + activation flow, the autonomous authors, the mock-contract gate, and the agent-bundle source
of truth. See [Phase 7 north star](../phase-7-authoring-agents.md),
[grill notes](./phase-7-authoring-agents.grill.md),
[ADR 0013](../adr/0013-autonomous-authoring-safe-activation.md),
[ADR 0014](../adr/0014-agent-bundles-dynamic-registration.md).

# Requirements

## ADRs + vocabulary (Slice 0 — BL-014a)
- **ADR 0013** (autonomous authoring & safe activation) + **ADR 0014** (agent bundles & dynamic
  registration).
- `CONTEXT.md` nouns: **Skill Author**, **Tool Author**, **Workflow Author**, **Hiring**,
  **Onboarding**, **Agent bundle**, **Authoring-policy skill**, **Safe activation**, **Proposal gate /
  pending-proposals queue**, **Approval seam / trust dial**; update **`agentRegistry`** ("derived view").
- `init.md` Phase 7 refinement; naming per `.cursor/rules/naming-conventions.mdc`.

## Authoring foundation (Slice 1 — BL-014b)
- **Authoring-policy skill** (editable markdown judgment): given a need, recommend the **form** —
  skill vs tool vs workflow vs new agent — with a stated rationale. Designed shareable with the future
  Engagement Manager reuse triage.
- **Proposal gate**: a project-management skill + tooling that drafts a **backlog GitHub Issue**
  containing the user story + **technical and non-technical** detail (reuse the grill → PRD →
  `github-create-issue` flow). The **backlog is the visible pending-proposals queue**.
- **Single approval seam**: one checkpoint function every "activate" routes through — hardwired to
  "ask the operator" (reuse the Phase 5 approval-audit), but structured so a future trust policy can
  answer "auto-approve when conditions hold" **without re-plumbing**.
- **Runaway control**: reuse the Phase 5 **attempt-cap**; at the cap, hard-stop + escalate.

## Skill Author (Slice 2 — BL-014c)
- Give the **Skill Engineer** an autonomous **notice → propose → draft → operator-activate** mode on
  the existing **lighter gate** (validate + permission + commit + telemetry).
- Trigger now: **explicit requests** (operator ask + existing `request-tool-build`).
- A newly authored/edited skill ships with an **eval case** (Phase 6 EDD) and does not go live without
  the logged operator activation through the seam.

## Tool Author (Slice 3 — BL-014d)
- **Engineering Lead** capability to **harden a hot/much-used skill into a tool** through the existing
  build → staged PR → QA review → promotion pipeline.
- Wire the **"used-a-lot" signal**: aggregate the Phase 6 skill-usage telemetry into a minimal "this
  skill is hot" signal that drives a proposal (cashing in Phase 6 D4's deferred hook). Minimal — only
  what the trigger needs, not a dashboard.
- **Mock-contract gate (#40 / BL-013):** a side-effecting tool **cannot go live** unless it declares a
  `testMode` mock and ships a test proving the side effect is suppressed (`mocked: true`). Implemented
  as a **blocking-but-overridable gate** in the pipeline (CI / permission-scan), reusing the Phase 5
  permission-scan + approval-audit. Carries forward and closes #40.

## Workflow Author (Slice 4 — BL-014e)
- **Engineering Lead** capability to author a **workflow** (deterministic ordering of tools/skills).
- Workflows are **code** → the **full code pipeline** (not the lighter gate); ships with a test.

## Hiring + Onboarding (Slice 5 — BL-014f)
- **Agent bundle** format: `agents/<id>/agent.(yaml|md)` config (role, authority, model, tools, skills,
  `directChat`, `standalone`) + the agent's own workspace folder (agent-scoped skills/examples/evals).
- **Committed bundle = source of truth**; `agentRegistry` becomes a **derived, validated view** (mirror
  of the Phase 6 skill move). **No `.ts` edits to add an agent.**
- **Thin loader reusing Mastra** (`addAgent` + Stored-Agents dependency resolution); `.mastra/` is a
  throwaway cache. **Startup-scan baseline** + Phase 5 **controlled restart**; **live slot-in is a
  bonus** attempted only if the installed Mastra supports it cleanly.
- **Hiring skill** — the judgment of whether/what to hire; ends in the proposal gate; **may invoke
  `grill-me-with-docs`** to interview the operator (auto-answerable later via the trust dial).
- **Onboarding skill** — wires starter skills/memory/registration and runs an **onboarding smoke-test**
  the new agent **must pass before activation** (a probation beat).
- **Authority validated**: an employee agent bundle structurally cannot be granted management-only
  tools (reuse the Phase 6 authority invariant).

## North-star verification (Slice 6 — BL-014g)
- `agents/README.md` (+ `skills/README.md` touch-ups) current; full eval matrix green locally;
  machinery + safety suites green in CI.

# Acceptance Criteria

- [ ] The **authoring-policy skill** recommends the right form (skill/tool/workflow/agent) with a
      rationale on seeded scenarios.
- [ ] A proposal produces a **well-formed backlog Issue** (user story + technical + non-technical
      detail) **before** any artifact is built; the backlog serves as the pending-proposals queue.
- [ ] **Nothing activates without a logged operator "yes"** through the single approval seam; the seam
      is structured so a future trust policy can relax it without re-plumbing.
- [ ] **Skill Author**: the Skill Engineer autonomously proposes + drafts a skill (with an eval) on the
      lighter gate; it goes live only after the logged activation.
- [ ] **Tool Author**: a hot-skill **used-a-lot signal** drives a tool proposal; the authored tool rides
      the full pipeline; the **mock-contract gate** blocks a side-effecting tool lacking a declared mock
      + test and passes a clean one (operator override is logged). **#40 closed.**
- [ ] **Workflow Author**: an authored workflow rides the **full code pipeline** with a test.
- [ ] **Hiring**: a new agent is a **committed bundle**; `agentRegistry` reflects it as a derived view;
      adding it needs **no `.ts` edits**; an **employee** bundle cannot be granted management-only tools.
- [ ] **Onboarding**: a hired agent goes active **only after passing its onboarding smoke-test**;
      reliable path is "approve → controlled restart → live"; de-registering is reversible.
- [ ] **Prove-before-activation**: an authored artifact missing its required test/eval **cannot
      activate**.
- [ ] **Runaway control**: autonomous drafting hard-stops + escalates at the attempt-cap.
- [ ] ADR 0013 + 0014 + `CONTEXT.md` vocabulary committed; north-star + `agents/README.md` current.

# Technical Notes

- **Framework-first:** reuse Mastra `addAgent` + Stored Agents / `MastraEditor` as the agent loader and
  Mastra **scorers** for judgment evals. **Verify the exact API surface against the installed version**
  at build time (dependencies pinned at `@mastra/core@^1.46`, `mastra@^1.15`). Thin anti-corruption
  wrapper over the loader; our **committed bundle is the source of truth**.
- **Determinism ratchet:** the when/whether/how-to-extend judgment is a **skill**; scaffold / validate /
  register / test are **tools**. The Tool Author is the ratchet made literal — a hot skill is *extracted*
  into a promoted tool.
- **Authority:** new authoring capabilities go to the **Engineering Lead** (management; building code) and
  the **Skill Engineer** (employee; skills). No new standalone agent in Phase 7; the Hiring judgment is a
  skill on the EL for now. Management authority stays scarce.
- **Safe activation reuses per-type gates:** lighter gate (skills) · full pipeline (tools/workflows) ·
  new explicit activation + onboarding smoke-test (agents). One logged operator "yes" on top; everything
  reversible (git revert / set draft / de-register).
- **Approval seam / trust dial:** a single checkpoint function; **no policy engine in Phase 7** (Phase
  14). The seam must be loosenable without re-plumbing.
- **Naming:** `agentRegistry` / `AgentRegistration` (existing; now a derived view), agent-bundle loader
  domain-qualified; authoring skills (`author-policy` / `write-tool` / `write-workflow` / `hire-agent` /
  `onboard-agent`) and the proposal gate domain-qualified per the naming rule.

# Out of Scope

Fully autonomous activation (posture C) and the **full approval policy/trust engine** — Phase 14 (Phase
7 builds only the seam). **Breakage-driven proposals** — documented, deferred (overlaps the Debugger,
Phase 4c). A **dedicated HR agent** — a later reversible upgrade. **"Adapt from external skill"**
(BL-011) and **aggregate skill-metrics dashboards** (BL-012) beyond the minimal used-a-lot signal.
**Phase 4b** (Engagement Manager + multi-agent chat) / **Phase 4c** (roster) — no hard dependency. Live
hot-load of agents if fiddly in the installed Mastra — fall back to controlled restart.

# Verification Commands

- `npm run typecheck`
- `npm run lint`
- `npm run test` (deterministic machinery / safety / mock-contract gate / agent-bundle discovery /
  approval-seam / attempt-cap suites)
- `npm run eval:skills` (local-only, requires API keys) — authoring-policy form selection, proposal
  Issue quality, onboarding convergence
