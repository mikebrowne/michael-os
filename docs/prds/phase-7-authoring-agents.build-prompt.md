# Phase 7 — Authoring Agents: fresh-agent build prompt

Hand this to a fresh agent to build Phase 7. The Phase 7 spec (north star, grill notes, PRD, ADRs
0013/0014, issues doc) is on `main`, and CI on `main` is green — start from `main`.

---

```
You are building Phase 7 — Authoring Agents for MichaelOS ("the system can safely extend itself").
This phase was fully grilled and scoped; do NOT re-litigate the decisions. Your job is to BUILD it,
in thin vertical slices, following the committed spec. Start from an up-to-date `main`.

## Read first (in this order)
- docs/phase-7-authoring-agents.md         (north star)
- docs/prds/phase-7-authoring-agents.grill.md   (every locked decision, D1–D18)
- docs/prds/phase-7-authoring-agents.md     (PRD: requirements + acceptance criteria per slice)
- docs/adr/0013-autonomous-authoring-safe-activation.md
- docs/adr/0014-agent-bundles-dynamic-registration.md
- docs/prds/phase-7-authoring-agents.issues.md  (epic BL-014 + slices BL-014a..g)
- CONTEXT.md (new Phase 7 vocabulary), AGENTS.md, and .cursor/rules/* (always-on rules)
Also skim how Phase 6 was built (skillRegistry, skill bundles, Skill Engineer) and Phase 5
(staging → QA gates → promotion, controlled restart, approval-audit) — Phase 7 reuses both heavily.

## Non-negotiable decisions (already settled — honor them)
- Autonomy posture B: the system NOTICES/IS-ASKED → PROPOSES (a reviewable backlog Issue, plain +
  technical) → DRAFTS (with its own passing test/eval) → ACTIVATES only behind an explicit, logged
  operator "yes". Everything reversible. No unattended activation (that's Phase 14).
- The when/whether/how-to-extend judgment is an EDITABLE MARKDOWN SKILL; muscle (scaffold/validate/
  register/test) is in tools. Each author = a judgment skill + tools (+ optional workflow).
- New capabilities go on EXISTING agents: Engineering Lead (tools/workflows) + Skill Engineer (skills).
  No new standalone agents. Hiring judgment is a skill on the EL for now.
- Safe activation REUSES existing per-type gates: lighter gate (skills), full code pipeline
  (tools/workflows), a NEW explicit activation step + onboarding smoke-test (agents). One logged
  operator "activate" on top; all reversible.
- Single approval SEAM (one checkpoint function), hardwired to "ask operator" now, structured so a
  future trust policy can loosen it WITHOUT re-plumbing. Build the seam, NOT a policy engine.
- Hiring = agents are COMMITTED BUNDLES (agents/<id>/agent.(yaml|md) + workspace folder); the committed
  file is the source of truth; agentRegistry becomes a DERIVED view (no .ts edits to add an agent).
- Hiring and Onboarding are TWO steps; onboarding ends in a must-pass smoke-test before activation.

## Framework-first (verify before hand-rolling)
- For the Hiring loader, REUSE Mastra: Mastra.addAgent(agent, key?, {source}) for live registration and
  Stored Agents / MastraEditor for config→agent + dependency resolution. VERIFY the exact API against
  the INSTALLED version (@mastra/core ^1.46, mastra ^1.15) in node_modules before relying on it. If live
  hot-load is fiddly, fall back to scan-at-startup + the Phase 5 controlled restart (the reliable
  baseline) — do NOT block the phase on no-restart loading.
- Same instinct everywhere: check Mastra docs + the installed version before building a new primitive.

## How to work
- Build in this slice order; ONE slice per branch/PR; keep each independently shippable + reversible:
  0. BL-014a — (the docs/ADRs/vocab/init already landed via #50) confirm Slice 0 is complete; add
     anything missing (naming, etc.).
  1. BL-014b — authoring foundation: authoring-policy skill + Issue-first proposal gate (reuse the
     grill→PRD→github-create-issue flow) + backlog-as-queue + the single approval seam + attempt-cap.
  2. BL-014c — Skill Author: Skill Engineer autonomous notice→propose→draft→activate on the lighter gate.
  3. BL-014d — Tool Author: harden a hot skill into a tool + the "used-a-lot" signal (cash in Phase 6's
     skill-usage telemetry hook) + the MOCK-CONTRACT GATE (blocking-but-overridable; closes #40). Full
     code pipeline.
  4. BL-014e — Workflow Author (full code pipeline).
  5. BL-014f — Hiring + Onboarding: agent-bundle format + thin loader (reuse Mastra) + hiring skill (may
     invoke grill-me-with-docs) + onboarding skill + onboarding smoke-test/probation. Validate authority
     (employee bundle can't hold management-only tools).
  6. BL-014g — north-star verification: agents/README.md, exit criteria proven for a skill+tool+workflow
     +agent, eval matrix + CI green.
- Every behavior change ships a test/eval. Nothing the system authors may activate without its own
  passing check. Red/green discipline (write the failing test first).
- Per slice: implement → keep CI green (see below) → commit (clear message, conventional style like the
  existing history) → push → open/update a PR with "Closes #<slice issue>" → check in with the operator
  before the next slice.
- Use the PR template. Draft PRs by default. Do not merge/auto-merge. Do not force-push or rewrite
  history. Do not leave the branch you're on without asking.

## CI must stay green (it is green on main now — keep it that way)
- CI runs `npm run typecheck && npm run lint && npm run build && npm test` with ZERO secrets (no
  OPENAI/CURSOR keys). Every slice must pass all four with no env keys set.
- Any test that exercises an agent/model path must use a MOCK agent and/or a non-placeholder FAKE key in
  its config so it runs keyless — follow the existing pattern in tests/delegationMachinery.test.ts and
  tests/observability.test.ts. Real-model behavior belongs in local-only eval scripts
  (npm run eval:skills), never in the keyless CI suite.
- Side-effecting tools you author must ship a testMode mock + a test proving the side effect is
  suppressed (the BL-014d mock-contract gate) — and that test must pass keyless.

## Guardrails (always-on rules)
- Public-safe: no secrets, .env values, real Vault data, or personal info in the repo. Tests/demos use
  the committed demo vault only. Commit .env.example placeholders only if new env vars are added.
- Reversibility: small isolated commits; feature-flag/optional-module new capabilities where it reduces
  risk (e.g. an env flag to disable autonomous proposals), mirroring CODING_EXECUTOR_MODE.
- Naming: domain-qualified per .cursor/rules/naming-conventions.mdc (no bare registry/manager/loader).
- Determinism ratchet: judgment in skills, danger in tools (which keep full QA).

## Issues / tracking
- The BL-014 epic + slice issues (BL-014a..g) are written in docs/prds/phase-7-authoring-agents.issues.md
  but may not be filed on GitHub yet. If you have issue-write access (token/MCP), file them from that doc
  and update the docs/README.md backlog table; otherwise BUILD from that doc as the spec, reference the
  BL-014x IDs in your branch names/PRs, and note in your summary that the issues still need filing.

## Start
Begin with Slice 1 (BL-014b) after confirming Slice 0 is complete. Post a short plan for BL-014b
(files you'll add/change + the test you'll write first, all keyless-CI-safe) and proceed.
```
