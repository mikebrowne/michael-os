# Autonomous authoring & safe activation: the system proposes, the operator activates

Through Phase 6 the system could author skills only when the **operator** drove it (the Skill
Engineer); Phase 6.5 made the build loop steerable. Phase 7 lets the harness **extend itself** — draft
new skills, tools, workflows, and agents — and the whole design question is how to do that **safely**.
**Decision:** adopt **autonomy posture B — "notices and proposes."** The system may **spot a need on
its own** (or be asked), **propose** the work as a **reviewable backlog Issue** (user story + technical
*and* non-technical detail) *before* anything is built, **draft** the artifact, and run the **existing
per-type safety rails** — but **activation is always an explicit, logged operator "yes,"** and
**everything is reversible**. The *judgment* of *when/whether/how to extend* (skill vs tool vs workflow
vs new agent) lives in an **editable markdown skill** (the authoring-policy skill), not in hard-coded
logic; the deterministic muscle (scaffold / validate / register / test) lives in **tools**. Each
"author" is therefore a **judgment skill on top of deterministic tools (+ an optional workflow)**, and
new authoring capabilities are handed to the agents we already have — the **Engineering Lead**
(tools/workflows; building code is already its job and authority) and the **Skill Engineer** (skills) —
rather than standing up new agents. Three of the four authors **plug into safety machinery that already
exists**: skills go live through the Phase 6 **lighter gate** (validate + permission + commit), and
tools/workflows go live through the Phase 5 **full pipeline** (build → staged PR → QA review →
promotion). Only **hiring a new agent** needs a genuinely new activation step (see ADR 0014). A single
unifying rule sits on top of all of them: **nothing the system authors becomes live without a logged
operator activation**, and **nothing it authors goes live without its own passing test/eval** (a skill
ships an eval, a tool ships a unit test **plus** its pretend-mode test, a workflow ships a test, a hired
agent must pass an onboarding smoke-test). The autonomy is **bounded** (reuse the Phase 5 attempt-cap;
hard-stop and escalate at the cap) and **visible** (proposals queue in the backlog, never auto-anything).

**The trust dial.** Phase 7 deliberately starts **low-trust / heavy human-in-the-loop** to prove the
loop works, but it must not paint us into a corner: every "ask the operator" moment routes through **one
approval seam** (a single checkpoint function), hardwired today to "always ask you" and reusing the
Phase 5 approval-audit, but **structured so a future trust policy can answer 'auto-approve when
conditions hold'** for low-risk categories **without re-plumbing**. We build the **seam**, not the
engine — the full approval **policy/trust engine** stays **Phase 14**. This is the same
feature-flag/reversibility instinct used across the project: design the loosenable seam now, defer the
mechanism that loosens it.

**Enforcing the mock contract (issue #40).** Phase 6 established the `testMode`/mock channel + contract
+ a fixture; Phase 7 **enforces** it for the Tool Author: a side-effecting tool (external write /
message-send) **cannot go live unless it declares a pretend-mode mock and ships a test** proving the
side effect is suppressed (`mocked: true`). This is implemented as a **blocking-by-default,
operator-overridable gate** in the existing pipeline (the same shape as CI / security / permission
gates), reusing the Phase 5 permission-scan + approval-audit — not a new parallel mechanism. Autonomy is
exactly where a silent hole would be dangerous, which is why #40 lives here.

Considered alternatives. **Posture A ("drafts only when explicitly told")** — rejected as the *default*;
it is safe but under-delivers on "extends itself" and forgoes the determinism-ratchet payoff of "this
skill is hot — want me to harden it?". (A is effectively where Phase 6 already sat.) **Posture C
("decide, build, and activate unattended")** — rejected for Phase 7; unattended self-modification is a
**Phase 14 trust** ambition and is unsafe before the loop is proven. **A single uniform on/off activation
switch for all artifact types** — rejected; it wraps the working per-type gates (lighter gate / full
pipeline) in a new layer, reinventing machinery and adding surface, against framework-first and
reversibility. **A general trust/rules engine in Phase 7** ("always allow skills in category X") —
rejected as scope; it is Phase 14, and building it now risks shipping standing power before the loop has
earned trust. We keep only the *seam*. **Hard-coding the authoring decision logic** (when to build /
what form) — rejected; the operator wants that judgment to be **editable markdown** they can rewrite as
their philosophy evolves, which is exactly what a skill is. **Fully unprompted "roaming" proposals** —
rejected for now; too noisy and hard to keep predictable/reversible in a phase whose headline is *safe*
self-extension; explicit-request and "used-a-lot" triggers cover the valuable cases, and
breakage-driven proposals are documented but deferred (they overlap the future Debugger). The trade-off
we accept: more orchestration in the EL/Skill Engineer and a second operator checkpoint (the proposal
Issue) under low trust — accepted because the proposal Issue *is* the reviewable artifact your rules
require, it doubles as the visible queue, and the trust dial lets the checkpoint relax later.

Mechanism. Triggers: **(1) explicit requests** (operator ask + the Skill Engineer's existing
`request-tool-build` handoff) wired immediately; **(2) the "used-a-lot" signal** (aggregate the Phase 6
skill-usage telemetry into a minimal "this skill is hot" signal) wired with the **Tool Author** slice,
cashing in the hook Phase 6 D4 deliberately left. The **proposal gate** reuses the grill → PRD →
`github-create-issue` flow to draft a backlog Issue; the backlog **is** the pending-proposals queue.
The **authoring-policy skill** selects the artifact form and is designed to be shareable with the
Phase 4b Engagement Manager's build-vs-reuse triage. Delivery follows the thin-vertical-slice order
**Skill Author → Tool Author → Workflow Author → Hiring**, each independently shippable and reversible;
see the [Phase 7 north star](../phase-7-authoring-agents.md) and
[PRD](../prds/phase-7-authoring-agents.md).
