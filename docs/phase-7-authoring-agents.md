# Phase 7: Authoring Agents (north star)

Through Phase 6 the system can **discover, validate, permission, observe, and compose** judgment
(skills), and Phase 6.5 made the engineering loop **steerable and observable** from the gateway. What
remains is for the harness to **build new pieces of itself** — new skills, tools, workflows, and even
new agents — and to do so **safely**. Phase 7 is that step. The operative word is **safely**: the new
capability is *autonomous drafting + a reviewable proposal + safe activation*, **not** unattended
self-modification.

## North star user story

> As the operator, MichaelOS now **notices** when it could improve itself — "this skill is getting
> reached for constantly; want me to harden it into a real tool?" — and it **proposes** the work as a
> reviewable backlog Issue, written in both plain language and technical detail, *before* anything is
> built. I say "go." It **drafts** the artifact, runs all the safety checks it already has, and brings
> it back with a passing test. Nothing goes **live** until I give an explicit, logged "activate." When
> it needs a whole new agent, it writes me a **job description** I can read like a hiring manager,
> **onboards** the new hire (wiring its skills/memory and running a smoke-test), and the hire only goes
> active once it passes probation. Everything it makes is reversible — it's all reviewable text and
> tracked changes. Today I'm in the loop on every step; over time I can **dial the loop back** without
> re-architecting anything.

## Core moves

1. **Autonomy posture B — "notices and proposes."** The system may spot a need on its own, propose it,
   draft it, and run the existing safety checks — but **activation is always an explicit, logged
   operator "yes."** (Posture C — decide/build/activate unattended — is a Phase 14 trust ambition.)
2. **Authoring policy is a *skill*, not code.** The judgment of *should we build this, and as a skill
   vs a tool vs a workflow vs a new agent* lives in an **editable markdown skill**. Rewriting the
   policy is a markdown edit. The deterministic muscle (scaffold / validate / register / test) stays in
   tools. (Determinism ratchet, applied to self-extension itself.)
3. **Every author = skill + tools (+ optional workflow).** New capabilities are handed to agents you
   already have — the **Engineering Lead** (tools/workflows; building code is already its job) and the
   **Skill Engineer** (skills) — rather than crowding the org chart with new agents.
4. **A reviewable proposal Issue *before* code.** "Propose" is concrete: the system drafts a **backlog
   GitHub Issue** with the user story + technical *and* non-technical detail for a "should we do this?"
   go-ahead, **reusing the existing grill → PRD → `github-create-issue` flow**. The backlog **is** the
   visible pending-proposals queue.
5. **Safe activation reuses the per-type gates you already built.** Skills → the **lighter gate**
   (validate + permission + commit); tools/workflows → the **full code pipeline** (build → staged PR →
   QA review → promotion); a **new agent** → a **new explicit activation step**. One rule on top:
   nothing goes live without a logged operator "activate," and everything is reversible.
6. **Hiring = committed agent bundles, loaded via Mastra.** An agent becomes a reviewable **bundle**
   (folder + config "job description"), the **committed file is the source of truth**, and
   `agentRegistry` becomes a **derived view** — no `.ts` edits to add an agent. The runtime mechanism
   **reuses Mastra** (`addAgent` + Stored-Agents dependency resolution); a controlled restart is the
   reliable baseline, live slot-in is a bonus.

## The authoring loop

```
notice / request  →  authoring-policy skill (skill? tool? workflow? agent?)
        │                         │
        │                         ▼
        │            proposal gate: draft a backlog Issue (user story + tech/non-tech)
        │                         │  ── operator checkpoint #1: "take on this project?"
        ▼                         ▼
   draft the artifact  →  ships with its OWN passing test/eval
        │
        ▼
   per-type safety gate (lighter for skills · full pipeline for tools/workflows · onboarding for agents)
        │  ── operator checkpoint #2: explicit, logged "activate"
        ▼
      LIVE  (fully reversible: git revert / set to draft / de-register the agent)
```

## The four authors

| Author | Lives on | Goes live via | Notable |
|---|---|---|---|
| **Skill Author** | Skill Engineer (autonomous mode) | lighter gate (validate + permission + commit) | first slice; lowest risk; proves the pattern |
| **Tool Author** | Engineering Lead (capability) | full code pipeline | "used-a-lot" trigger; enforces the **mock contract** (#40) |
| **Workflow Author** | Engineering Lead (capability) | full code pipeline | workflows are code today |
| **Hiring + Onboarding** | Engineering Lead (skills + bundle plumbing) | **new explicit activation** after a passing onboarding smoke-test | capstone; agent-as-bundle |

## What triggers a proposal

- **Now:** explicit requests — the operator asks, or the Skill Engineer's existing `request-tool-build`
  handoff.
- **With the Tool Author:** the **"used-a-lot" signal** — watch which skills are reached for constantly
  and propose hardening the hot one into a tool (cashing in the Phase 6 usage hook).
- **Deferred (documented):** "keeps breaking" signals (overlaps the future Debugger).
- **Out of scope:** fully unprompted roaming.

## Hiring vs onboarding (two steps)

- **Hiring** — the *judgment*: should we add this role, and what's its job description (the bundle
  config)? Ends in the operator go-ahead. May pull the operator into a **quick grill** ("we need agent
  X because of Y; any other skills/tools it should have?") — auto-answerable later as trust grows.
- **Onboarding** — the *getting-it-working*: starter skills, memory, registration, and a **smoke-test
  it must pass before activation** (a probation beat).

## Runaway control, approval, and the trust dial

- **Caps:** autonomous drafting reuses the Phase 5 **attempt-cap**; at the cap it hard-stops and
  escalates rather than looping.
- **Visibility:** proposals land in the **backlog queue**, never auto-anything.
- **Approval stays simple:** a logged, **per-item operator "yes"** (reuse the Phase 5 approval-audit).
  **No general trust/rules engine in Phase 7** — that stays **Phase 14**.
- **Trust is a dial:** start **low-trust / heavy human-in-the-loop**, but route every "ask the
  operator" moment through **one approval seam** so a future trust policy can later relax it for
  low-risk categories **without re-plumbing**. We build the seam, not the engine.

## Framework-first (verify against the installed version at build time)

The installed Mastra (`@mastra/core@^1.46`, `mastra@^1.15`) already exposes the agent-authoring
machinery, so the Hiring loader is a **thin wrapper**, not a hand-roll:

| Mastra capability | Role in Phase 7 |
|---|---|
| `Mastra.addAgent(agent, key?, { source })` | register a new agent into a **running** instance (no restart) |
| **Stored Agents** / `MastraEditor` (PR #10953) | instantiate a config-defined agent; resolve its tools/workflows/sub-agents/memory from the registry; versioning |

Our domain owns the **source of truth** (the committed agent bundle) and the **judgment** (the hiring/
onboarding/authoring skills); Mastra provides the runtime loader. The gitignored `.mastra/` store is a
throwaway cache. See [ADR 0014](./adr/0014-agent-bundles-dynamic-registration.md). This is the same
framework-first instinct that made Phase 6 reuse Mastra Agent Skills behind `skillRegistry`.

## Delivery slices

0. **Chore** — ADR 0013 + 0014; `CONTEXT.md` vocabulary; `init.md` refinement; naming.
1. **Authoring foundation** — the editable **authoring-policy skill**; the **Issue-first proposal
   gate** (reuse PRD → `github-create-issue`); backlog = proposal queue; the **single approval seam**;
   reuse the Phase 5 attempt-cap + approval-audit.
2. **Skill Author** — Skill Engineer's autonomous notice → propose → draft → activate mode (lighter
   gate); explicit-request trigger.
3. **Tool Author** — EL "harden a hot skill into a tool"; the **used-a-lot** signal; the
   **mock-contract gate** (#40); full code pipeline.
4. **Workflow Author** — EL capability; full pipeline.
5. **Hiring + Onboarding** — agent-bundle format + thin loader (reuse Mastra); hiring skill (may grill)
   + onboarding skill; onboarding smoke-test/probation; controlled-restart baseline + live-load bonus.
6. **North-star verification** — docs + `agents/README` + wrap.

## What "safe self-extension ready" means (exit criteria)

- The system can **notice or be asked**, **propose a reviewable Issue** (plain + technical), **draft**
  the artifact with its **own passing test/eval**, and bring it to **live only behind an explicit,
  logged operator activation** — for a **skill**, a **tool**, a **workflow**, and a **new agent**.
- A **side-effecting tool cannot go live** without a declared pretend-mode (mock) + a test (#40).
- A **new agent** is a **committed, reviewable bundle**; adding one needs **no `.ts` edits**; it goes
  active only after passing its **onboarding smoke-test**; removing it is reversible.
- Autonomous drafting is **bounded** (attempt-cap + escalation) and **visible** (backlog queue).
- Every "ask the operator" moment flows through **one approval seam** that a future trust policy can
  loosen without re-plumbing.

## Out of scope (later)

- **Fully autonomous activation** (posture C) and the **full approval policy/trust engine** — Phase 14
  (Phase 7 builds only the seam).
- **Breakage-driven proposals** — documented, deferred (overlaps the **Debugger**, Phase 4c).
- A **dedicated "HR" agent** — a later reversible upgrade if it earns its own identity.
- **"Adapt from external skill"** (BL-011) and **aggregate skill-metrics dashboards** (BL-012) beyond
  the minimal used-a-lot signal.
- Live hot-load of agents **if** it proves fiddly in the installed Mastra — fall back to controlled
  restart.

## Relationship to other phases

- **Phase 6 (done)** — judgment is first-class (skills) + the operator-driven Skill Engineer; Phase 7
  gives the system **initiative** to extend itself.
- **Phase 6.5 (done)** — the steerable loop authored tools/agents will be built and observed through.
- **Phase 4b** — the Engagement Manager's build-vs-reuse triage shares the **authoring-policy** judgment
  (designed shareable).
- **Phase 4c** — the **Debugger** is the agent form of the deferred breakage-driven proposals.
- **Phase 8** — the org-wide **Chief of Staff** generalizes routing/coordination.
- **Phase 14** — **trust**: the policy engine that lets the loop run with less human involvement.
