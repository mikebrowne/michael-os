# Objective

Ship Phase 5: **staging, review, and promotion** — every generated change is **staged** as a
reviewable PR, **verified** by the QA Engineer through blocking-but-overridable gates (CI, code
review, security review, permission review), and **promoted** to `main` only on operator approval,
with **one-command rollback** and a **controlled restart**. The Engineering Department should run
like a professional software-building agency.

# Background

Phase 4 delivered agentic delegation, the Job system, and a foundational observability substrate;
review verdicts were **advisory** and `ship-implementation` pushed **directly to `main`**. Phase 5
replaces direct-push with a real promotion pipeline and upgrades the advisory Code Reviewer into a
consolidated **QA Engineer** that runs a **deterministic verification workflow**. See
[phase-5 north star](../phase-5-staging-review-promotion.md) and
[grill notes](./phase-5-staging-review-promotion.grill.md).

# Requirements

## ADRs + vocabulary + rename (Slice 0)
- ADR 0007 (PR-based staging, promotion & rollback) + ADR 0008 (QA Engineer verification model).
- `CONTEXT.md` definitions: **Staging/staged change**, **Gate**, **QA Engineer**, **Promotion**,
  **PromotionRecord/promotionRegistry**, **Rollback**; `build-verification` Job kind.
- Rename `code-reviewer` → `qa-engineer` in `agentRegistry` (role "QA Engineer", `employee`).

## Staging + PR promotion + rollback (Slice 1)
- `GitRunner` (extend) + `GhRunner` (new) anti-corruption wrappers around `git`/`gh`.
- **Stage** = push `feature/<slug>-<runId>` from the build worktree + open a PR (body = PRD link +
  acceptance test + verification verdict). The PR diff is the staged diff.
- **Promote** = merge the PR to `main`; write a `PromotionRecord`.
- **Rollback** = `git revert` of the promotion commit (forward-only; never force-push).
- `promotionRegistry` / `PromotionRecord` in `.mastra/` (LibSQL), projection over git linking
  Issue/WorkItem/Job ↔ commit SHA + gates passed/overridden.
- Replaces direct-to-`main` `ship-implementation`.

## QA Engineer + first gates (Slice 2)
- Upgrade Code Reviewer → **QA Engineer** (`employee`) running a **deterministic verification
  workflow** (fixed ordering; gates cannot be skipped).
- First gates: **CI gate** (local validation tool: lint/typecheck/build/test) + **code review**
  (skill). Aggregate into a composite verdict.
- New `build-verification` Job kind + composite output schema (`gates: [{kind,status,findings}],
  overall`).
- EL delegates one `build-verification` Job, folds the verdict into the D+ report → **single
  promotion blocker** (YES/NO + per-gate override; override logged).
- **Remediation loop (core):** a red verdict (not overridden) hands findings back to the EL, which
  **light-triages** (security/permission → surface to operator; spec gap → escalate for re-spec;
  code-level → fix) and runs a **bounded fix→re-verify loop** — re-build with findings as **fresh
  context**, **cap 3 attempts** (configurable via config/`.env`), each attempt operator-visible and
  recorded on the Job + telemetry; cap hit → hard-stop + escalate + WorkItem `blocked`.
- **New states:** `staged` (PR open, verifying) and `blocked` (cap hit) added to `WorkItemStage`.
- **Approval-audit logging (Decision C):** the dangerous-tool gate logs every approval **and denial**
  (with audit context) for promote/rollback/restart to run logs/telemetry; denials abort with no
  side effects.

## Remaining gates (Slice 3)
- Add **security-review** (skill) + **permission-scan** (tool) to the verification workflow.
- Permission scan flags capability-expanding hunks: dangerous tools, authority escalation,
  dependency changes, security/CI rails (`.github/workflows/**`, `.gitignore`, gitleaks,
  `.env.example`, `AGENTS.md`, `.cursor/rules/**`), and shell/delete/network/message code patterns.
- Wire **remote CI precondition** via `gh pr checks` (overridable).

## Rollback & ledger UX + NO routing (Slice 4)
- Gateway commands: `rollback #N`, `promotions` (list), `promotion #N` (detail).
- **Operator NO routing** — four outcomes: **fix** (default → remediation loop), **change the spec**
  (→ grill/re-PRD), **park** (→ `parked`), **abandon** (→ close PR, `abandoned`).
- **Parked state:** branch kept; PR kept open as **draft + `parked` label**; issue stays open and
  moves to the project **Backlog** column; resumable via `resume #N` / `list`.

## Controlled restart (Slice 5)
- `restart` command (management + YES): drain in-flight Jobs, flush telemetry, persist state, exit
  with sentinel; OS supervisor (launchd) relaunches.
- EL detects `src/**` promotions and suggests a restart.
- Three chat lifecycle messages via the daemon→client bus: restarting (with drain count), down
  (client auto-reconnects), back up (with commit SHA).
- launchd plist documented in `docs/local-dev.md`.

## Verification (Slice 6)
Deterministic suites run in CI with zero secrets; judgment evals run local-only with a real model.

- **Machinery (CI):** staging/promotion/rollback against a **local bare git repo**; `GhRunner` calls
  + fake CI statuses (remote-red blocks unless overridden); QA verification machinery (controlled
  model); ledger written; jobs never stuck.
- **Safety/security (CI):** **no-direct-push-to-main** regression; **gate-cannot-be-skipped**
  invariant; override recorded in ledger/telemetry; **approval audit** (approval + denial logged;
  denial aborts with no side effects); **clearance** (QA Engineer cannot promote/rollback/restart);
  **permission scanner** per-rule cases + clean-diff negative.
- **Remediation/red-path (CI, controlled model):** loop **cap halts** (no infinite loop) →
  `blocked` + escalate; attempts recorded + fresh-context (findings, not transcript); triage routing
  (security/permission surfaced, spec-gap escalated, code-level looped); NO routing (fix/re-spec/
  park/abandon) + `parked` resume; `staged`/`blocked`/`parked` in `WorkItemStage`.
- **Restart (CI):** drain (refuse new jobs; in-flight finish/marked; state persisted; sentinel exit)
  + three lifecycle messages; harness boot smoke test.
- **Judgment evals (local-only, real model):** `npm run eval:promotion` (end-to-end clean promote)
  plus seeded-vulnerability-caught, seeded-defect-caught, no-false-block-on-clean, triage-routes-
  correctly, and remediation-converges/halts.

# Acceptance Criteria

- [ ] Green build is **staged** as a branch + PR; no direct push to `main`.
- [ ] QA Engineer runs a deterministic verification workflow (CI + code review + security +
      permission) and returns one composite `build-verification` verdict.
- [ ] Promotion is **blocked** unless all gates green or a specific gate is **overridden** (logged in
      ledger + telemetry).
- [ ] **Promotion** merges the PR to `main` and writes a `PromotionRecord` linking
      Issue/WorkItem/Job ↔ commit SHA.
- [ ] `rollback #N` reverts a promotion; `promotions` / `promotion #N` inspect the ledger.
- [ ] **Controlled restart** drains in-flight Jobs and relaunches via supervisor; chat shows
      down/up, back-up includes the commit SHA.
- [ ] Permission scan flags capability-expanding hunks for explicit acknowledgement.
- [ ] Remote CI red blocks merge unless overridden.
- [ ] CI machinery tests pass against a bare-repo remote with zero secrets, including
      no-direct-push-to-main, gate-cannot-be-skipped, approval-audit (denial aborts, no side effects),
      and clearance (QA Engineer cannot promote/rollback/restart).
- [ ] Permission scanner has per-rule tests + a clean-diff negative (no false positives).
- [ ] Loop-cap-halts test proves the remediation loop never runs forever.
- [ ] Judgment evals (local-only) prove the gates catch a seeded vuln + seeded defect, don't
      false-block a clean change, route triage correctly, and converge/halt; eval scripts documented.
- [ ] A red verdict / operator NO kicks the change back to the EL (not promoted, not discarded); PR
      stays open as a draft.
- [ ] The EL remediation loop is bounded (cap 3, configurable) and hard-stops into `blocked` with an
      operator escalation; attempts use fresh context + findings and are recorded.
- [ ] EL light triage surfaces security/permission findings and escalates spec gaps instead of
      looping.
- [ ] A NO routes to fix / re-spec / park / abandon; `parked` preserves work (draft PR + label +
      Backlog) and resumes via `resume #N`.
- [ ] `staged` / `blocked` / `parked` states exist in `WorkItemStage`.
- [ ] Promote/rollback/restart approvals **and denials** are logged (Decision C).
- [ ] ADR 0007 + ADR 0008 + `CONTEXT.md` vocabulary committed; north-star doc current.

# Technical Notes

- **Framework-first:** reuse Mastra supervisor agents (Phase 4), a Mastra **workflow** for the
  deterministic gate ordering, the Phase 4 `jobRunner`, git/GitHub for staging/promotion, and the OS
  process supervisor (launchd) for restart. Thin anti-corruption wrappers: `GitRunner`/`GhRunner`,
  `promotionRegistry`.
- **Authority:** stage/promote/rollback/restart are dangerous → **management** (EL) + operator YES;
  the QA Engineer is an **employee** and structurally cannot deploy. Extend `DANGEROUS_TOOL_IDS`
  with `promote`/`rollback`/`restart`.
- **Approval audit (Decision C / partial BL-003):** upgrade `approvalGate` to log every approval and
  denial (with audit context) to run logs/telemetry; full capability coverage beyond these actions
  stays in a shrunken [BL-003 (#1)](https://github.com/mikebrowne/michael-os/issues/1).
- **Remediation:** EL owns the fix loop (re-build with findings as fresh context); cap is read from
  config/`.env` (default 3); a dedicated Debugger sub-agent is deferred.
- **Determinism ratchet:** CI + permission scan are tools (deterministic); code + security review are
  skills (judgment). The LLM never *claims* CI/scan results — it calls the real tool.
- **Naming:** `qa-engineer`, `build-verification`, `promotionRegistry`/`PromotionRecord`,
  `GhRunner` — all domain-qualified per `.cursor/rules/naming-conventions.mdc`.
- Docs continue to ship directly via `ship-docs`; the pipeline is implementation-only.

# Out of Scope

Phase 5b / later: multi-environment staging, canary/blue-green, auto-merge / promotion without
operator, standalone Security and DevOps agents, broader QA skills (regression/perf/a11y),
hard-blocking gates with no override, cross-process pubsub, self-healing auto-rollback, a dedicated
Debugger sub-agent, smarter automated triage / automated re-spec, and the remainder of BL-003's
dangerous-capability coverage (shell, dependency install, file deletion, secrets, external writes).

# Verification Commands

- `npm run typecheck`
- `npm run lint`
- `npm run test` (includes the deterministic machinery / safety / remediation / restart suites)
- `npm run eval:promotion` (local-only, requires API keys + `gh` auth) — end-to-end clean promote
- `npm run eval:gates` (local-only, requires API keys) — gate recall/precision (seeded vuln + seeded
  defect caught, no false-block), triage routing, remediation converge/halt
