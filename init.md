# MichaelOS Build Plan

## Always-On Build Rules

These are not phases. They apply from day one through Cursor rules, AGENTS.md, repo rules, CI rules, and future agent operating principles.

1. **Public-safe by default**

   * The repo must be safe to build in public.
   * No private vault data, API keys, logs, traces, webhook URLs, journal entries, personal data, or sensitive config should enter the public repo.

2. **GitHub is the build system of record**

   * Buildable work becomes GitHub Issues, specs, PRs, commits, project items, CI checks, or reviewable diffs.

3. **Private data stays outside the public repo**

   * Obsidian vaults, private logs, traces, local config, and runtime state remain outside the tracked repository.

4. **Secrets are referenced, never exposed**

   * Use `.env`.
   * Commit `.env.example`.
   * Never expose secret values.

5. **Agents propose changes through reviewable artifacts**

   * Specs
   * Issues
   * Diffs
   * PRs
   * Promotion requests

6. **Dangerous capabilities require approval**

   * Shell execution
   * Dependency installation
   * File deletion
   * Permission expansion
   * External writes
   * Sending messages
   * Harness restarts
   * Secrets access

7. **Observability expands with capability**

   * Every new feature should add telemetry.

8. **Build thin vertical slices**

   * Build complete loops.
   * Then make each layer deeper.

9. **Code for deterministic work**

   * LLMs for judgment.
   * Code for repeatable operations.

10. **Everything should be reversible**

    * Git
    * Tests
    * CI
    * Rollback
    * Promotion history

# Phase 0: Public Safe Repo and Project Tracking

## Goal

A public-safe repository with project tracking, CI, issue templates, and engineering guardrails.

### User Stories

* Public GitHub repository
* GitHub Projects
* GitHub Issues
* Issue templates
* `.env.example`
* Secret scanning
* Initial CI
* Cursor rules
* AGENTS.md

# Phase 1: Minimal Mastra Runtime

## Goal

A local Mastra runtime capable of hosting agents, tools, workflows, and observability.

### User Stories

* Minimal Mastra project
* Folder structure
* Local configuration
* Demo vault
* Local logging
* Mac mini runtime

# Phase 2: First Tiny Engineering Loop

## Goal

Prove one complete engineering loop.

### User Stories

* Engineering Lead agent
* Spec skill
* GitHub Issue tool
* File tools
* Test tool
* Logging
* First successful end-to-end build

# Phase 3: Seed Skills and Engineering Department

## Goal

Create a small but capable Engineering Department.

> **Delivered scope (shipped 2026-06-27).** Phase 3 shipped the **agent registry**, the
> **Engineering Lead** (management), the **QA Engineer / Code Reviewer** (employee), the **Software
> Engineer** as an explicit `external-executor` (Cursor), the seed engineering skills, and the
> always-on gateway (DevOps slice). The **broader roster** below (Debugger / Security / DevOps as
> agents, plus the Spec/Planning/Test split) and the **necessity/reuse reviewer (formerly "Ponytail")**
> were **deferred and rescoped**: the reviewer becomes the **Engagement Manager** in **Phase 4b**, and
> the roster expansion is **Phase 4c**. Phase 6 changes the calculus — many roles are now *skills on an
> existing agent*, so 4c starts with an explicit "agent vs skill" decision per role.

### User Stories

* Seed engineering skills — **done**
* Skill folder convention — **done**
* Matt Pocock inspired skills — **done**
* Agent registry — **done**
* Reviewer Agent (→ QA Engineer) — **done**
* Implementation Agent (→ Software Engineer / Cursor `external-executor`) — **done**
* Necessity/reuse reviewer (formerly "Ponytail") → **Engagement Manager, rescoped to Phase 4b**
* Spec Agent / Planning Agent / Test Agent → **rescoped to Phase 4c (agent-vs-skill decision)**
* Debugger Agent → **rescoped to Phase 4c** (completes the steerable-loop diagnosis surface)
* Security Agent → **partially shipped as the QA security gate (Phase 5); dedicated agent → Phase 4c**
* DevOps Agent → **shipped as the always-on gateway/daemon slice**

# Phase 4: Sessions, Delegation, and Job System

## Goal

Allow bounded delegation with full observability.

### User Stories

* User sessions
* Agent threads
* Delegation jobs
* Workflow runs
* Delegation tool
* Context references
* Job queue
* Structured outputs
* Model selection
* Full traceability

# Phase 4b: Multi-Agent Chat and the Engagement Manager

## Goal

A single conversational front door that can talk to more than one agent, with a coordinator —
the **Engagement Manager** — that routes incoming work and runs build-vs-reuse triage.

> The **Engagement Manager** is the professional-agency rename of the old "Ponytail" necessity
> reviewer. It owns **intake → triage → routing**: take the operator's request, decide whether
> something already exists (reuse) or must be built, and route to the right specialist (Engineering
> Lead, Skill Engineer, …). This is the **engineering-scoped** precursor to the org-wide **Chief of
> Staff** (Phase 8): 4b is the chat plumbing + simple routing + reuse triage; Phase 8 is intelligent,
> org-wide context routing and delegation summaries.

### User Stories

* Multi-agent chat surface (talk to / switch between registered `directChat` agents)
* **Engagement Manager** agent (coordinator; routes to specialists)
* Simple routing (request → right agent by role/skill/authority)
* **Build-vs-reuse triage** — "does this already exist?" from three sources: the registries
  (deterministic: `agentRegistry` / `skillRegistry` / tool list), **codebase comprehension**
  (judgment, via the read-only Cursor mode — see Phase 6.5), and the web (external / framework-first)
* Necessity verdict (build / reuse / adapt) recorded as a reviewable artifact
* Boundary with Chief of Staff (Phase 8) documented, not duplicated

# Phase 4c: Expand the Engineering Team

## Goal

Grow the department roster deferred from Phase 3, deciding **agent vs skill** for each role.

> Phase 6 made roles cheaper: a "specialist" can be a **skill on an existing agent** rather than a
> whole new `mastra-agent`. 4c starts each role with that decision (per `CONTEXT.md` determinism
> ratchet) and only stands up a separate agent when the role needs its own authority, memory, or
> direct chat.

### User Stories

* Agent-vs-skill decision rule per role (authority / memory / directChat criteria)
* **Debugger** — consumes the Phase 6.5 inspection + comprehension tooling for root-cause across files
* **Security** — promote the Phase 5 security gate into a dedicated reviewer where it earns its keep
* **Spec / Planning / Test** — split out of the Engineering Lead loop only where a dedicated agent helps
* Each new hire ships through the **full QA pipeline** (the agent itself is code); its later *skill*
  edits ride the lighter gate

# Phase 5: Staging, Review, and Promotion

## Goal

Every generated change is staged, reviewed, validated, and promotable.

### User Stories

* Staged diffs
* Review workflow
* Security review
* CI integration
* Permission review
* Rollback
* Controlled restart flow

# Phase 6: Skill Platform

## Goal

Skills become first-class reusable system objects.

> **Grilled 2026-06-28 — framework-first pivot.** The installed Mastra (`@mastra/core@^1.46`) already
> ships the full **Agent Skills** system (spec format, validation, index, progressive loading, shared
> vs agent-specific scoping, versioning). Phase 6 **adopts Mastra Agent Skills behind a thin
> `skillRegistry` wrapper** and builds only the domain gaps: authority/permission gating,
> Job-correlated telemetry, the **Skill Engineer** agent, and skill **EDD**. See
> [docs/phase-6-skill-platform.md](./docs/phase-6-skill-platform.md),
> [ADR 0009](./docs/adr/0009-mastra-agent-skills-substrate.md),
> [ADR 0010](./docs/adr/0010-skill-permission-lifecycle.md).

### User Stories

* YAML skill format → Mastra `SKILL.md` + frontmatter (domain fields in `metadata`)
* Shared skills → `workspace.skills`
* Agent-specific skills → per-agent `Agent.skills` + frontmatter `scope`
* Skill index → `workspace.skills.list/search`, injected as `markdown`
* Progressive loading → Mastra `skill` / `skill_search` / `skill_read` tools (retire eager concat)
* Skill permissions → `allowed-tools` ⊆ agent authority (enforced at validation + injection)
* Script-backed skills → skills **invoke** Engineering-built, promoted Tools/Workflows (muscle is not embedded; `scripts/` not executed)
* Skill validation → `validateSkillMetadata` wrapper + scope/permission checks
* Skill telemetry → five Job-correlated `skill.*` run-log events
* **Skill Engineer** agent (employee) + lighter-gate lifecycle (skill changes bypass full QA)
* Skill **EDD** (`evals/` + Mastra scorers + `npm run eval:skills`) + tool `testMode`/mock

Deferred to Phase 7: autonomous authoring agents (Skill Author / Tool Author / Hiring),
"adapt from external skill", and automated enforcement that every side-effecting tool ships a mock.

# Phase 6.5: Steerable Engineering Loop

## Goal

Close the remaining gap to **100% engineering off the IDE**: make the build loop **steerable,
observable, and diagnosable** from the gateway, so the operator rarely needs the editor for
engineering work. This is the immediate next build after Phase 6.

> **Why now.** The build engine already runs headless via the Cursor SDK in isolated worktrees, but
> it uses one-shot `Agent.prompt` (fire-and-wait) — a black box you can't steer, observe, or debug
> without opening the IDE. The single architectural move is migrating the executor to a **durable
> Cursor session** (`Agent.create` / `agent.send` / `Agent.resume`), which unlocks plan-mode,
> slice-by-slice execution, streaming, interrupt, and restart-survival at once. See
> [docs/phase-6.5-steerable-loop.md](./docs/phase-6.5-steerable-loop.md),
> [ADR 0011](./docs/adr/0011-steerable-builds-plan-and-slice.md),
> [ADR 0012](./docs/adr/0012-cursor-comprehension-mode.md).

> **Plan/agent mode.** The Cursor **SDK exposes a native conversation mode** —
> `mode: "agent" | "plan"` (`AgentModeOption`), settable at `Agent.create` (`AgentOptions.mode`) **and
> per `send`** (`SendOptions.mode`). So we use `mode: "plan"` for the plan turn and `mode: "agent"` for
> slice execution, switchable within one durable session (the IDE plan→act flow, natively). The
> **Engineering Lead still owns the plan/checklist** and dispatches **one bounded slice per `send`**,
> verifying each before advancing — not because the SDK lacks plan mode, but because judgment,
> authority, telemetry, and gates belong in the EL. The SWE stays a dumb, bounded executor.

> **Leverage Cursor for reasoning, not only writing.** Cursor's harness is a *codebase reasoning
> engine*. Expose it in two authority-gated modes behind the `CodingExecutor` seam: a **read-only
> comprehension mode** (map structure / find existing / plan integration — employee-safe, used by EL
> planning, Debugger, Skill Engineer, the Engagement Manager's reuse triage) and the existing
> **implementation mode** (writes code — management-gated). Use it for judgment-heavy multi-hop
> questions; use `Grep`/registries for cheap lookups (the determinism ratchet).

### User Stories

* Executor migrated to durable Cursor session (`Agent.create`/`send`/`resume`)
* **Plan-then-slice**: EL produces/owns a checklist; SWE executes one slice per `send`, verified between
* **Streaming** build output in the gateway (`run.stream`)
* **Interrupt / redirect** a drifting build (`run.cancel` + follow-up `send`)
* **In-loop inspection**: read a worktree file, re-run a single test, tail the build log from chat
* **Failure diagnosis surface**: logs / diffs / test output surfaced in-loop (precursor to the Debugger)
* **Read-only codebase comprehension mode** (integration mapping + reuse discovery; cite-and-verify)
* **PR / CI ingestion**: PR review comments + CI failures pulled back as loop inputs
* **Operator visibility**: a status/diff view of in-flight work (`Agent.list` / `Agent.getRun`)
* **Session-scoped approval** (minimal): pre-authorize a class of actions for the session to enable
  "kick off and walk away" (the full policy engine stays near Phase 7 "safe activation" / Phase 14)
* Restart-survival: reattach to an in-flight build after a gateway restart (`Agent.resume`)

Out of scope (later): the full approval **policy engine** (Phase 7/14 trust), a rich web dashboard
beyond a minimal status surface, and the autonomous authoring agents (Phase 7).

# Phase 7: Authoring Agents

## Goal

The system can safely extend itself.

> **Grilled 2026-06-30 — "notices and proposes," not unattended self-modification.** Phase 7 adopts
> autonomy **posture B**: the system may **notice a need or be asked**, **propose** the work as a
> reviewable backlog Issue (user story + technical *and* non-technical detail) *before* any code, and
> **draft** it — but **activation is always an explicit, logged operator decision** and everything is
> reversible. The *judgment* of **when/whether/how to extend** (skill vs tool vs workflow vs new agent)
> lives in an **editable markdown authoring-policy skill**; the muscle (scaffold/validate/register/test)
> lives in tools. New authoring capabilities are handed to the **Engineering Lead** (tools/workflows) and
> the **Skill Engineer** (skills) — **no new standalone agents**; the Hiring judgment is a skill on the
> EL for now. Build order is **Skill Author → Tool Author → Workflow Author → Hiring**. See
> [docs/phase-7-authoring-agents.md](./docs/phase-7-authoring-agents.md),
> [grill notes](./docs/prds/phase-7-authoring-agents.grill.md),
> [ADR 0013](./docs/adr/0013-autonomous-authoring-safe-activation.md),
> [ADR 0014](./docs/adr/0014-agent-bundles-dynamic-registration.md).

### User Stories

* **Skill Author** — the Skill Engineer gains an autonomous notice→propose→draft mode (lighter gate)
* **Tool Author** — an Engineering Lead capability that **hardens a hot skill into a promoted tool**
  (the determinism ratchet, made literal), riding the full code pipeline
* **Workflow Author** — an Engineering Lead capability (workflows are code → full pipeline)
* **Hiring + Onboarding** — agents become **committed bundles** (config + folder) that are the source of
  truth, loaded via Mastra; a **hiring** skill (may grill the operator) + an **onboarding** skill with a
  must-pass **onboarding smoke-test** before activation
* **Staged promotion / Engineering review** — authored *code* rides the existing Phase 5 rails (build →
  staged PR → QA review → promotion); authored *skills* ride the Phase 6 lighter gate
* **Safe activation** — reuse the per-type gates + one logged operator "activate" yes; everything
  reversible; a **single approval seam** designed to loosen later (the trust dial)

Decision (from the Phase 6 grill, now scoped): the **Tool Author** enforces the **tool test-mode/mock
contract** (#40 / BL-013) — every side-effecting tool (external writes, message-sending) must support a
`testMode` flag (via `requestContext`) returning a declared mock instead of the real effect, ship that
mock as part of the tool, and include a test. Phase 6 built the channel + contract + fixture; Phase 7
makes it a **blocking-but-overridable gate** (CI / permission-scan), reusing the Phase 5 permission-scan
+ approval-audit.

Decision (the YAML-agents idea, now scoped → ADR 0014): an agent is a **committed bundle** —
`agents/<id>/agent.(yaml|md)` config + the agent's own workspace folder — and the **committed file is the
source of truth** (no `.ts` edits to add an agent), with `agentRegistry` demoted to a **derived view**.
The runtime loader **reuses Mastra** (`addAgent` + Stored-Agents dependency resolution); the reliable
path is scan-at-startup + the Phase 5 controlled restart, with **live slot-in (no restart) as a bonus**
where the installed Mastra supports it.

Decision (hiring vs onboarding, now scoped → ADR 0013): they are **two steps** — **hiring** (decide +
write the job description, ending in operator go-ahead, may grill) and **onboarding** (wire skills/
memory/registration + a must-pass smoke-test before activation).

Out of scope → **Phase 14 trust**: fully autonomous activation (posture C) and the full approval
**policy/trust engine** (Phase 7 builds only the loosenable seam). Deferred: breakage-driven proposals
(overlap the Debugger, Phase 4c), a dedicated "HR" agent, "adapt from external skill" (BL-011), and
aggregate skill-metrics dashboards (BL-012) beyond the minimal "used-a-lot" signal.

# Phase 8: Chief of Staff

## Goal

A conversational router that coordinates the organization.

### User Stories

* Chief of Staff
* Agent directory
* Intelligent routing
* Context routing
* Engineering delegation
* Delegation summaries

# Phase 9: Second Brain / Wiki LLM

## Goal

Convert raw information into durable structured knowledge.

### User Stories

* Private Obsidian vault
* Raw inboxes
* Inbox triage
* Structured wiki
* Wiki updates
* Commitments
* Reminders
* Scheduled jobs
* GitHub Issues
* Skill ideas
* Tool ideas
* Workflow ideas
* Agent ideas
* Project notes
* Journal entries
* Public artifact ideas
* Safe Obsidian tools
* Source tracking
* Wiki metadata
* Structured RAG
* Privacy boundaries

# Phase 10: Scheduled Jobs and Operations

## Goal

A reliable local scheduling platform.

### User Stories

* Cron and launchd
* Job registry
* Temporary reminders
* Recurring workflows
* Tags
* Categories
* Folder organization
* Workflow schedules
* Logging
* Webhooks
* Secure webhook execution

# Phase 11: Project Finishing

## Goal

Turn unfinished work into leverage.

### User Stories

* Project Finisher department
* Finish/archive decisions
* Lessons learned
* Public memos
* README generation
* Reusable components

# Phase 12: Additional Departments

## Goal

Expand into broader life and business domains.

### User Stories

* Journal Coach
* Fitness Department
* Business Strategy
* Email integration
* Calendar integration
* Plaud integration
* WhatsApp integration
* Safe external actions

# Phase 13: Public Journal

## Goal

Build in public without losing the fun.

### User Stories

* Build logs
* Loom videos
* Livestreams
* Architecture notes
* Public artifacts
* Safety filters
* Optional content repurposing
* Loose polymath journal

# Phase 14: Self-Evolving Organization

## Goal

A trustworthy personal AI organization that compounds over time.

### User Stories

* Local-first AI organization
* Self-improving engineering
* Safe self-extension
* Durable leverage
* Better memory
* Better execution
* More finished projects
* Greater long-term compounding
