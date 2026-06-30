# Objective

Define the decisions and scope for **Phase 7: Authoring Agents** — *the system can safely extend
itself*. The north star: MichaelOS can **draft new skills, tools, workflows, and agents on its own,
propose them as reviewable artifacts, and bring them to life only behind an explicit, logged operator
approval** — reusing the existing per-type safety rails, with every self-authored artifact carrying a
passing test/eval before it can go live. Synthesized from the grill session on 2026-06-30. Builds on
[Phase 6](../phase-6-skill-platform.md) (the Skill Platform + operator-driven Skill Engineer) and
[Phase 6.5](../phase-6.5-steerable-loop.md) (the steerable, observable engineering loop), and the
determinism ratchet in [`CONTEXT.md`](../../CONTEXT.md).

**Framework-first finding (to confirm against the installed version at build time):** the installed
Mastra (`@mastra/core@^1.46`, `mastra@^1.15`) already exposes the machinery for **defining an agent
from config and registering it at runtime** — `Mastra.addAgent(agent, key?, { source?: "code" |
"stored" })` to add an agent to a **running** instance without a restart, plus **Stored Agents** /
`MastraEditor` (PR #10953, shipped earlier in the 1.x line) for config-defined agents whose tools /
workflows / sub-agents / memory are resolved from the registry, with versioning. Phase 7 therefore
**reuses this loader machinery behind a thin wrapper** rather than hand-rolling one — the same
framework-first move Phase 6 made with Mastra Agent Skills. See
[ADR 0013](../adr/0013-autonomous-authoring-safe-activation.md) and
[ADR 0014](../adr/0014-agent-bundles-dynamic-registration.md).

# Decisions

## North star & guiding principles

- **North star (above).** "Safely extends itself" — the emphasis is on **safely**. Phase 7's novelty
  is *autonomous drafting + a proposal gate + safe activation*, **not** unattended self-modification.
- **Determinism ratchet preserved:** the *judgment* of when/whether/how to extend the system lives in
  **skills** (editable markdown); the *muscle* (scaffold, validate, register, test) lives in
  **deterministic tools/workflows**. Authoring policy is always one markdown edit away from changing.
- **Phase 6 → Phase 7 seam:** Phase 6 shipped the **operator-driven** Skill Engineer (you initiate;
  it authors). Phase 7 adds **initiative** — the system may *notice and propose* — while keeping the
  activation decision human.

## D1 — Autonomy posture: "notices and proposes" (posture B)

- The system may **spot a need on its own** and **propose** extending itself (not only wait to be
  told), **draft** the artifact, and **run the existing safety checks** — but **activation always
  requires an explicit operator "yes."**
- Rejected: **(A)** "drafts only when told" (safe but under-delivers on self-extension); **(C)**
  "decides, builds, and activates unattended" (a Phase 14 trust ambition, out of scope now).

## D2 — Build order: a sequence of authors, not four at once

- Thin-vertical-slice discipline: build **one complete author end-to-end, then layer**, in order:
  **Skill Author → Tool Author → Workflow Author → Hiring (+ Onboarding)**.
- Rationale: Skill Author is the **cheapest complete loop** (the Skill Engineer already exists) and
  proves the autonomy + safe-activation pattern on the lowest-risk material (text). Tool Author is the
  **high-value** one (real code rails + the #40 mock contract). Workflow Author rides the same rails.
  **Hiring stays in Phase 7** as the capstone (operator decision: not spun out).

## D3 — Agent vs skill per author: new capabilities, not new hires

- Per the Phase 6 calculus (a role can be a *skill on an existing agent*; only "hire" a new agent when
  it needs its own authority / memory / chat presence):
  - **Skill Author → no new hire.** The existing **Skill Engineer** gains an autonomous "notice →
    propose → draft" mode. (`CONTEXT.md` already reserves "Skill Author" for this autonomous behavior.)
  - **Tool Author → no new hire.** A new capability on the **Engineering Lead** (building/promoting
    code is already its job + authority).
  - **Workflow Author → no new hire.** Also on the Engineering Lead.
  - **Hiring → no new standalone agent *yet*.** The *judgment* is a hiring/onboarding **skill** (plus
    the agent-bundle plumbing), given to the Engineering Lead for now; a dedicated "HR" agent is a
    clean, reversible upgrade later if it earns its own identity.
- **Phase 7 mostly hands new playbooks (+ matching tools/plumbing) to the EL and the Skill Engineer —
  it does not crowd the org chart.** Management authority stays scarce.

## D4 — The "when/whether/how to extend" decision is itself a skill

- The decision-making logic — *should we build this, and as a skill vs a tool vs a workflow vs a new
  agent?* — is an **editable markdown skill** (probabilistic, agentic judgment), **not hard-coded**.
  Rewriting the authoring policy is a markdown edit. The deterministic muscle (scaffold/validate/
  register/test) stays in tools. This overlaps with the future Engagement Manager's build-vs-reuse
  triage (Phase 4b) and should be designed to be shareable.

## D5 — Compositional pattern: every author = skill + tools (+ optional workflow)

- Each "author" is built the same way: a **judgment skill** (the editable when/whether/how playbook)
  on top of **deterministic tools** and, where useful, a **workflow**. The Hiring agent is the fullest
  example — it gets its own tools + a workflow + an onboarding/entry skill, not just a single prompt.

## D6 — Safe activation: reuse per-type gates + one operator "yes" on top

- Each artifact goes live through the safety path that already fits it (do **not** reinvent a parallel
  approval system — framework-first):
  - **Skill** (text) → the existing **lighter gate** (validate + permission/scope check + commit).
  - **Tool / Workflow** (code) → the existing **full rails** (build → staged PR → QA review →
    **promotion to main**).
  - **New agent** → a **new, explicit activation step** (the one genuinely new gate).
- **Unifying rule (posture B):** nothing the system authors becomes live without an **explicit,
  logged operator "activate" yes**, and **everything is reversible** (git revert / set back to draft /
  de-register the agent).
- Rejected: **(A)** a single uniform on/off switch wrapping the existing rails in a new layer
  (reinvents working machinery).

## D7 — What triggers an autonomous proposal

- **Wire now: (1) explicit requests** — operator asks in chat, or the Skill Engineer's existing
  `request-tool-build` handoff.
- **Wire with the Tool Author slice: (2) "used-a-lot" signals (the ratchet)** — watch which skills are
  reached for constantly and propose hardening the hot one into a tool. Cashes in the Phase 6 usage
  hook (aggregate metrics deliberately deferred in Phase 6 D4).
- **Document but defer: (3) "keeps breaking" signals** (overlaps the future Debugger).
- **Explicitly skip: (4)** fully unprompted roaming (too loose for a *safe* self-extension phase).

## D8 — Project-management proposal gate: a reviewable Issue *before* any code

- The "propose" step is concrete: the system drafts a **backlog GitHub Issue** with the **user story +
  the pertinent technical *and* non-technical details** for the operator to review and approve
  **before anything is built** ("should we take on this project?"). This is a **product/project-
  management skill** that **reuses the existing grill → PRD → `github-create-issue` flow**.
- The **backlog doubles as the visible "pending proposals" queue** (no new gadget).
- Under low trust this yields **two human checkpoints**: (1) "yes, take on this project" at the Issue
  stage (pre-code); (2) "yes, activate/promote it" at the end.

## D9 — Runaway control & approval sophistication (caps + visibility, not a policy engine)

- **Caps:** autonomous drafting is **bounded** by reusing the Phase 5 attempt-cap pattern; at the cap
  it **hard-stops and escalates** rather than looping.
- **Visibility:** proposals land in a **visible, reversible backlog/queue** (D8), never auto-anything.
- **Approval stays deliberately simple:** plain, **logged, per-item operator "yes"** reusing the Phase
  5 approval-audit trail. **No general trust/rules engine in Phase 7** — the full policy/trust engine
  stays **Phase 14**.

## D10 — Trust is a dial, designed to loosen later

- Start **low-trust / heavy human-in-the-loop** to prove it works, with the explicit intent to grant
  **more trust over time** (eventually approaching full handoff).
- **Design requirement:** every "ask the operator" moment routes through **one checkpoint seam** (a
  single approval gate), hardwired today to "always ask you," but **structured so a future trust policy
  (Phase 14) can answer 'auto-approve when conditions hold'** for low-risk categories **without
  re-plumbing**. We build the *seam*, not the engine.

## D11 — Hiring architecture: agents as committed bundles, loaded via Mastra

- An agent is a **bundle (folder)** mirroring skill bundles: `agents/<id>/agent.(yaml|md)` config (the
  "job description": role, authority, model, tools, skills, directChat, standalone) **plus** the
  agent's own workspace folder (agent-scoped skills, examples, evals, memory config).
- **The committed bundle file is the single source of truth** — public-safe, reviewable in a diff,
  git-reversible — and **`agentRegistry` becomes a derived, validated view** (the identical move Phase
  6 made for skills). **Adding/changing an agent requires no `.ts` edits.**
- **Runtime mechanism reuses Mastra** (`addAgent` + Stored-Agents dependency resolution) as the
  **loader**; the gitignored `.mastra/` store is a **throwaway cache, never the truth**.
- **Loading:** the reliable baseline is **scan-the-folder-at-startup**, so the Phase 5 **controlled
  restart** always works ("approve job description → controlled restart → agent live"). **Live slot-in
  without a restart is a bonus** attempted only if the installed Mastra cleanly supports it.
- Rejected: **(B)** Mastra's database-backed agents as the source of truth (not reviewable, not in git,
  cuts against public-safe).

## D12 — Hiring is two steps: hiring then onboarding

- **Hiring** = the *judgment* — should we add this role, and what's its job description (the config) —
  ending in the operator go-ahead (the D8 proposal gate). The hiring skill **may pull the operator into
  a quick grill** (reuse `grill-me-with-docs`): "we need agent X because of Y user stories; any other
  skills/tools/workflows it should have?" — and, per D10, that grill participation can later be
  **auto-answered** by the system as trust grows.
- **Onboarding** = the *getting-it-working* — give it starter skills, wire memory, register it, and run
  an **onboarding smoke-test/eval** ("can it do its basic job?") it **must pass before activation** (a
  probation beat). A later "clone an existing agent" path is just hiring-with-a-template → same
  onboarding.
- Rejected: **(A)** a single "create this agent" step (loses the probation safety beat).

## D13 — Mock contract (#40): a blocking-but-overridable gate

- Phase 6 built the `testMode`/mock **channel + contract + fixture**. Phase 7 **enforces** it: a
  side-effecting tool (external write / message-send) **cannot go live unless it declares a pretend-
  mode (mock) and ships a test** proving the real side effect is suppressed (telemetry `mocked: true`).
- Implemented as a **gate in the existing pipeline** (CI / permission-scan), **blocking by default,
  operator-overridable with a logged reason** — the same gate pattern as CI / security / permission.
  Reuses the Phase 5 permission-scan + approval-audit machinery. Carries forward issue **#40 / BL-013**.
- Rejected: **(A)** author's-good-behavior-only (leaves a hole exactly where autonomy makes holes
  dangerous).

## D14 — Prove-it-before-activation (red/green for self-authored work)

- **Nothing the system authors goes live until it ships with its own passing check:** a **skill** → an
  eval case (Phase 6 EDD); a **tool** → a unit test **plus** the D13 pretend-mode test; a **workflow**
  → a test; a **hired agent** → the D12 onboarding smoke-test. The check is **part of the artifact**, so
  rollback stays safe. Straight from the "add tests for new behavior so rollback is safe" rule.

## D15 — Workflow classification: code, full pipeline

- Workflows are **real code today**, so authoring a workflow rides the **full code pipeline** (build →
  review → promote), **not** the lighter skill gate. (Revisit if workflows ever become a declarative
  config format.)

## D16 — Documentation artifacts

- **ADR 0013** — Autonomous authoring & safe activation (posture B; Issue-first proposal gate; reuse
  per-type gates; the single approval seam designed to loosen; caps/queue; trust-is-a-dial).
- **ADR 0014** — Agents as committed bundles, dynamically registered (agent-as-folder/config is the
  source of truth; `agentRegistry` derived view; reuse Mastra `addAgent`/Stored-Agents as loader;
  startup-scan baseline + controlled-restart + live-load bonus).
- **North-star phase doc** `docs/phase-7-authoring-agents.md`; **PRD** `docs/prds/phase-7-authoring-agents.md`.
- New `CONTEXT.md` nouns: **Skill Author**, **Tool Author**, **Workflow Author**, **Hiring** &
  **Onboarding**, **Agent bundle**, **Authoring-policy skill**, **Safe activation**, **Proposal gate /
  pending-proposals queue**, **Approval seam / trust dial**, **`agentRegistry` as derived view** (update).
- Small **`init.md`** Phase 7 refinement; **`docs/README.md`** backlog + ADR + key-docs updates.

## D17 — Delivery slices (foundation first, then layer the authors)

0. **Chore** — ADR 0013 + 0014; `CONTEXT.md` vocabulary; `init.md` Phase 7 refinement; naming.
1. **Authoring foundation** — the editable **authoring-policy skill** (when/whether/how, D4); the
   **Issue-first proposal gate** (reuse PRD → `github-create-issue`, D8); the **backlog = proposal
   queue**; the **single approval seam** (D9/D10, hardwired to "ask," built to loosen); reuse the
   Phase 5 **attempt-cap** + approval-audit.
2. **Skill Author** — give the Skill Engineer the autonomous **notice → propose → draft → operator
   activate** mode on the **lighter gate** (D1/D3); trigger (1) explicit requests (D7).
3. **Tool Author** — EL capability to **harden a hot skill into a tool**; wire the **"used-a-lot"
   signal** (D7, cashing in Phase 6's usage hook); enforce the **mock-contract gate** (#40 / D13);
   rides the **full code pipeline** (D14/D15).
4. **Workflow Author** — EL capability; full pipeline (D15).
5. **Hiring + Onboarding** — **agent-bundle** format + thin loader reusing Mastra (D11); the **hiring**
   skill (may grill, D12) + **onboarding** skill; the **onboarding smoke-test/probation** (D12/D14);
   controlled-restart baseline + live-load bonus (D11).
6. **North-star verification** — docs + `agents/README` (and `skills/README`) + wrap.

## D18 — Evals & tests (sketch; detailed in the PRD)

- **Deterministic (CI, no secrets, no model):** agent-bundle discovery builds the derived
  `agentRegistry` view + validates frontmatter/authority; the **mock-contract gate** flags a
  side-effecting tool lacking a declared mock + test and passes a clean one; the **approval seam**
  blocks activation without a logged operator "yes"; the **attempt-cap** hard-stops/escalates; an
  authored artifact missing its required test/eval **cannot activate** (D14).
- **Judgment evals (local-only, real model):** the **authoring-policy skill** picks the right form
  (skill vs tool vs workflow vs agent) on seeded scenarios; the **proposal gate** produces a
  well-formed Issue (user story + technical/non-technical detail); **onboarding convergence** — a hired
  agent passes its smoke-test.

# Open questions resolved

- Autonomy posture → **B ("notices and proposes")**; activation always behind an explicit operator yes.
- Build all four at once? → **No.** Ordered sequence **Skill → Tool → Workflow → Hiring**; **Hiring
  stays in Phase 7**.
- New agents or new capabilities? → **New capabilities** on the **Engineering Lead** and **Skill
  Engineer**; no new standalone agent in Phase 7 (Hiring's judgment is a skill on the EL for now).
- Where does the create/extend decision live? → an **editable markdown skill** (judgment), not
  hard-coded; muscle stays in tools.
- Author composition → each author = **skill + tools (+ optional workflow)**; Hiring is the fullest.
- Safe activation → **reuse per-type gates** (lighter for skills, full pipeline for code, new explicit
  step for agents) + **one logged operator "activate" yes**; all reversible.
- Triggers → **(1) explicit now**, **(2) used-a-lot with the Tool Author**, **(3) breakage deferred**,
  **(4) roaming skipped**.
- Proposal mechanism → a **reviewable backlog Issue** (user story + technical & non-technical detail)
  **before code**; reuse grill → PRD → `github-create-issue`; backlog = the proposal queue.
- Runaway/approval → **caps + visible queue + simple per-item logged approval**; **no policy engine**
  (Phase 14).
- Trust → **low now, designed to loosen**; one **approval seam** a future trust policy can relax
  without re-plumbing.
- Hiring architecture → **committed agent bundle is source of truth**; `agentRegistry` a derived view;
  **reuse Mastra `addAgent`/Stored-Agents as the loader**; startup-scan + controlled-restart baseline,
  live-load a bonus; `.mastra/` is a cache.
- Hiring vs onboarding → **two steps**; hiring may grill the operator (auto-answerable later);
  onboarding ends in a **must-pass smoke-test/probation** before activation.
- Mock contract (#40) → a **blocking-but-overridable gate** in the existing pipeline; reuse Phase 5
  permission-scan/approval-audit.
- Prove-before-activation → **yes**; every self-authored artifact ships a passing test/eval.
- Workflow classification → **code → full pipeline**.
- Docs → **ADR 0013 + 0014**; north-star + PRD; `CONTEXT.md` vocabulary; `init.md`/README updates.
- Issues → new **`[BL-014]`** epic + slice issues **BL-014a..g**; fold **#40 / BL-013** into the Tool
  Author slice.

# Out of scope (→ later phases)

- **Fully autonomous activation / unattended self-modification** (posture C) — Phase 14 trust.
- The **full approval *policy/trust engine*** (standing-permission rules, trust classes) — **Phase 14**
  (Phase 7 builds only the *seam*).
- **Breakage-driven proposals** (skill repeatedly fails → propose a fix/tool) — documented, deferred
  (overlaps the **Debugger**, Phase 4c).
- A **dedicated "HR" / Hiring agent** with its own identity — a later reversible upgrade if it earns it.
- **"Adapt from external skill"** (advanced `create-skill` over Mastra's `external` source) — BL-011 /
  later.
- **Aggregate skill-metrics dashboards** beyond the minimal "used-a-lot" signal the Tool Author needs —
  BL-012 / later.
- **Phase 4b** (Engagement Manager + multi-agent chat) and **Phase 4c** (roster: Debugger / Security /
  Spec / Planning / Test) — Phase 7 must not hard-depend on them, though the authoring-policy skill is
  designed to be shareable with the Engagement Manager's reuse triage.
- Live hot-load of agents **if** the installed Mastra makes it fiddly — fall back to the controlled
  restart; do not block Phase 7 on it.
