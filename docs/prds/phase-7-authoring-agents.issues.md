# Phase 7 — Authoring Agents: issues to file

Ready-to-file GitHub issues for Phase 7 (epic **BL-014** + slices **BL-014a..g**). Prepared as a
committed doc because issue creation is unavailable from the current (read-only `gh`) environment — file
each verbatim via the GitHub web UI or the harness's `github-create-issue` tool, then record the issue
numbers in the [backlog table](../README.md). Keep the `[BL-NNN]` IDs; do not renumber.

- **Existing:** **BL-013 / #40** ("enforce tool test-mode/mock contract") is the Tool Author
  carry-forward — **fold it into / close it with BL-014d**, or relabel it as BL-014d.
- **Labels:** add `phase-7` + the type label noted per issue. Add each to the **MichaelOS Build** project.

---

## EPIC — `[BL-014] Authoring Agents: the system safely extends itself`

**Labels:** `enhancement`, `spec`, `phase-7`

```md
## Phase
P7 — Authoring Agents

## Epic
The system can **safely extend itself** — draft new skills, tools, workflows, and agents on its own,
propose them as reviewable artifacts, and bring them live only behind an explicit operator approval.
**Grilled 2026-06-30**, autonomy **posture B ("notices and proposes")**: autonomous *drafting +
proposal + safe activation*, NOT unattended self-modification (posture C is Phase 14 trust).

## North star
MichaelOS notices when it could improve itself (or is asked), proposes the work as a reviewable backlog
Issue (user story + technical & non-technical detail) BEFORE any code, drafts it (with its own passing
test/eval), and activates it only behind a logged operator "yes" — for a skill, a tool, a workflow, and
a new agent. The when/whether/how-to-extend judgment is an **editable markdown skill**; the muscle is in
tools. New capabilities go to the **Engineering Lead** (tools/workflows) and the **Skill Engineer**
(skills) — no new standalone agents. Everything is reversible; trust starts low and is designed to dial
up later through a single approval seam.

## Docs
- North star: `docs/phase-7-authoring-agents.md`
- PRD: `docs/prds/phase-7-authoring-agents.md`
- Grill notes: `docs/prds/phase-7-authoring-agents.grill.md`
- ADR 0013 (autonomous authoring & safe activation), ADR 0014 (agent bundles & dynamic registration)

## Slices (sub-issues BL-014a..g)
- **BL-014a** Slice 0 — ADRs 0013/0014 + `CONTEXT.md` vocabulary + `init.md` + naming
- **BL-014b** Slice 1 — authoring foundation: authoring-policy skill + Issue-first proposal gate +
  backlog-as-queue + single approval seam + attempt-cap
- **BL-014c** Slice 2 — Skill Author (Skill Engineer autonomous notice→propose→draft→activate, lighter gate)
- **BL-014d** Slice 3 — Tool Author: harden a hot skill into a tool + "used-a-lot" signal +
  **mock-contract gate** (#40); full code pipeline
- **BL-014e** Slice 4 — Workflow Author (full code pipeline)
- **BL-014f** Slice 5 — Hiring + Onboarding: agent bundles + thin loader (reuse Mastra) + hiring/
  onboarding skills + onboarding smoke-test/probation
- **BL-014g** Slice 6 — north-star verification

## Acceptance criteria
- [ ] Authoring-policy skill picks the right form (skill/tool/workflow/agent) with a rationale
- [ ] A proposal produces a well-formed backlog Issue (user story + tech/non-tech) before any code
- [ ] Nothing activates without a logged operator "yes" through the single approval seam
- [ ] Skill Author proposes + drafts a skill (with eval) on the lighter gate; Tool Author hardens a hot
      skill into a tool on the full pipeline; the **mock-contract gate** blocks a side-effecting tool
      lacking a declared mock + test (override logged) — **#40 closed**
- [ ] Workflow Author rides the full pipeline with a test
- [ ] A new agent is a committed bundle (no `.ts` edits); `agentRegistry` is a derived view; an employee
      bundle can't hold management-only tools; it activates only after passing its onboarding smoke-test
- [ ] Self-authored artifacts can't activate without a passing test/eval; drafting hard-stops at the cap
- [ ] ADR 0013 + 0014 + `CONTEXT.md` vocabulary committed; north-star + `agents/README.md` current

## Deferred (Phase 14 / later)
Fully autonomous activation (posture C) + the full approval policy/trust engine (Phase 14); breakage-
driven proposals (overlap the Debugger, Phase 4c); a dedicated "HR" agent; "adapt from external skill"
(BL-011); aggregate skill-metrics dashboards (BL-012) beyond the minimal used-a-lot signal.

This issue contains no secrets or private data.
```

---

## `[BL-014a] Phase 7 Slice 0 — ADRs 0013/0014 + authoring vocabulary`

**Labels:** `docs`, `spec`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
Phase 7 introduces autonomous authoring and safe activation. The architectural decisions and shared
vocabulary must be recorded before code so every later slice builds on the same nouns.

## Scope / deliverables
- ADR 0013 — autonomous authoring & safe activation (posture B; Issue-first proposal gate; reuse per-type
  gates; the single approval seam designed to loosen; caps/queue; trust-is-a-dial). [committed]
- ADR 0014 — agents as committed bundles, dynamically registered via Mastra. [committed]
- `CONTEXT.md` nouns: Safe self-extension, Authoring-policy skill, Skill/Tool/Workflow Author, Proposal
  gate / pending-proposals queue, Safe activation, Approval seam / trust dial, Agent bundle, Hiring /
  Onboarding. [committed]
- `init.md` Phase 7 refinement + `docs/README.md` backlog/ADR/key-docs updates. [committed]
- Naming per `.cursor/rules/naming-conventions.mdc`.

## Acceptance criteria
- [ ] ADR 0013 + 0014 present and linked from `docs/README.md`
- [ ] `CONTEXT.md` carries all Phase 7 nouns; `init.md` Phase 7 reflects the grill
- [ ] Naming review passes (domain-qualified)

(Docs for this slice already drafted in the Phase 7 docs branch.)

This issue contains no secrets or private data.
```

---

## `[BL-014b] Phase 7 Slice 1 — authoring foundation (policy skill + proposal gate + approval seam)`

**Labels:** `enhancement`, `runtime`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
Every author needs a shared foundation: a way to decide what form a need should take, a way to propose it
for review before building, and a single, auditable place where the operator approves activation —
designed so trust can be dialed up later without re-plumbing.

## Scope / deliverables
- **Authoring-policy skill** (editable markdown): recommend skill vs tool vs workflow vs new agent, with a
  stated rationale. Designed shareable with the Phase 4b Engagement Manager reuse triage.
- **Proposal gate**: a project-management skill + tooling that drafts a backlog GitHub Issue (user story +
  technical AND non-technical detail), reusing the grill → PRD → `github-create-issue` flow. The backlog
  is the visible pending-proposals queue.
- **Single approval seam**: one checkpoint function every "activate" routes through — hardwired to "ask
  the operator" (reuse Phase 5 approval-audit), structured so a future trust policy can auto-approve
  without re-plumbing.
- **Runaway control**: reuse the Phase 5 attempt-cap; hard-stop + escalate at the cap.

## Acceptance criteria
- [ ] Authoring-policy skill selects the right form with a rationale on seeded scenarios
- [ ] A proposal produces a well-formed backlog Issue before any artifact is built
- [ ] Activation cannot proceed without a logged operator "yes" through the seam
- [ ] The seam exposes a single override point a future trust policy can relax (test-asserted)
- [ ] Autonomous drafting hard-stops + escalates at the attempt-cap

This issue contains no secrets or private data.
```

---

## `[BL-014c] Phase 7 Slice 2 — Skill Author (autonomous Skill Engineer)`

**Labels:** `enhancement`, `runtime`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
Prove the autonomy + safe-activation pattern on the lowest-risk material (skills, already reversible text)
before applying it to code and agents.

## Scope / deliverables
- Give the **Skill Engineer** an autonomous notice → propose → draft → operator-activate mode on the
  existing **lighter gate** (validate + permission + commit + telemetry).
- Trigger now: explicit requests (operator ask + the existing `request-tool-build` handoff).
- A newly authored/edited skill ships with an **eval case** (Phase 6 EDD) and goes live only after the
  logged activation through the seam (Slice 1).

## Acceptance criteria
- [ ] The Skill Engineer autonomously proposes (via the proposal gate) and drafts a skill with an eval
- [ ] The skill activates only after the logged operator "yes"; the lighter gate still applies
- [ ] A skill missing its eval cannot activate
- [ ] Dangerous-tool declaration still surfaces the Phase 6 operator acknowledgement

This issue contains no secrets or private data.
```

---

## `[BL-014d] Phase 7 Slice 3 — Tool Author + mock-contract gate (closes #40)`

**Labels:** `enhancement`, `runtime`, `ci`, `phase-7` · **Parent:** BL-014 · **Closes:** #40 (BL-013)

```md
## Parent epic
BL-014 (#TBD)

## Problem
The high-value author: turn a hot, much-used skill into faster, safer deterministic code — the
determinism ratchet made literal — and guarantee self-authored side-effecting tools can't ship without a
safe "pretend mode" (the carry-forward from the Phase 6 grill, #40).

## Scope / deliverables
- **Engineering Lead** capability to harden a hot/much-used skill into a tool through the existing build →
  staged PR → QA review → promotion pipeline.
- **"Used-a-lot" signal**: aggregate the Phase 6 skill-usage telemetry into a minimal "this skill is hot"
  signal that drives a proposal (cashing in Phase 6 D4's deferred hook). Minimal — only what the trigger
  needs, not a dashboard.
- **Mock-contract gate (#40)**: a side-effecting tool cannot go live unless it declares a `testMode` mock
  and ships a test proving the side effect is suppressed (`mocked: true`). Blocking-by-default,
  operator-overridable (logged), reusing the Phase 5 permission-scan + approval-audit.

## Acceptance criteria
- [ ] A hot-skill signal drives a tool proposal; the authored tool rides the full pipeline with a test
- [ ] The mock-contract gate blocks a side-effecting tool lacking a declared mock + test and passes a
      clean one; overrides are logged
- [ ] #40 / BL-013 closed by this slice

This issue contains no secrets or private data.
```

---

## `[BL-014e] Phase 7 Slice 4 — Workflow Author`

**Labels:** `enhancement`, `runtime`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
The system should be able to author **workflows** (deterministic orderings of tools/skills). Workflows are
code today, so they ride the full pipeline.

## Scope / deliverables
- **Engineering Lead** capability to author a workflow via the proposal gate + full code pipeline.
- The authored workflow ships with a test.

## Acceptance criteria
- [ ] An authored workflow rides the full code pipeline with a test and activates only behind the seam
- [ ] Workflow authoring reuses the Slice 1 foundation (policy skill + proposal gate + approval seam)

This issue contains no secrets or private data.
```

---

## `[BL-014f] Phase 7 Slice 5 — Hiring + Onboarding (agent bundles)`

**Labels:** `enhancement`, `runtime`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
The capstone: let the system hire a new agent safely and on its own, without writing code or forcing a
restart — and don't let a new hire go active until it's proven it can do its basic job.

## Scope / deliverables
- **Agent bundle** format: `agents/<id>/agent.(yaml|md)` config + the agent's own workspace folder; the
  committed bundle is the source of truth; `agentRegistry` becomes a derived, validated view (no `.ts`
  edits to add an agent).
- **Thin loader reusing Mastra** (`addAgent` + Stored-Agents dependency resolution); `.mastra/` is a
  throwaway cache. Startup-scan baseline + Phase 5 controlled restart; live slot-in is a bonus (verify the
  installed Mastra API). 
- **Hiring skill** — judgment of whether/what to hire; ends in the proposal gate; may invoke
  `grill-me-with-docs` (auto-answerable later via the trust dial).
- **Onboarding skill** — wire starter skills/memory/registration + run an **onboarding smoke-test** the
  agent must pass before activation.
- Authority validated: an employee bundle cannot be granted management-only tools (Phase 6 invariant).

## Acceptance criteria
- [ ] A new agent is a committed bundle; `agentRegistry` reflects it as a derived view; no `.ts` edits
- [ ] Reliable path is "approve → controlled restart → live"; de-registering is reversible
- [ ] A hired agent activates only after passing its onboarding smoke-test
- [ ] An employee bundle cannot hold management-only tools (test-asserted)

This issue contains no secrets or private data.
```

---

## `[BL-014g] Phase 7 Slice 6 — north-star verification`

**Labels:** `docs`, `phase-7` · **Parent:** BL-014

```md
## Parent epic
BL-014 (#TBD)

## Problem
Close the phase: prove the end-to-end "safe self-extension" loop and leave the docs current.

## Scope / deliverables
- `agents/README.md` (+ `skills/README.md` touch-ups) current.
- Full eval matrix green locally (`npm run eval:skills`): authoring-policy form selection, proposal Issue
  quality, onboarding convergence.
- Machinery + safety suites green in CI (`npm run typecheck`, `npm run lint`, `npm run test`).

## Acceptance criteria
- [ ] Exit criteria in `docs/phase-7-authoring-agents.md` demonstrably met for a skill, a tool, a
      workflow, and a new agent
- [ ] Docs/READMEs current; CI green; local eval matrix green

This issue contains no secrets or private data.
```
