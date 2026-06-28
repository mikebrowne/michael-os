# Objective

Define the decisions and scope for **Phase 5: Staging, Review, and Promotion** — *every
generated change is staged, reviewed, validated, and promotable*. The north star: the
Engineering Department **runs like a real software-building agency and acts professional** —
a green build is **staged** as a reviewable PR, a **QA Engineer** runs blocking-but-overridable
**gates** (CI, code review, security review, permission review), and the change is **promoted**
to `main` only on operator approval, with **one-command rollback** and a **controlled restart**.

Synthesized from the grill session on 2026-06-28. Builds on
[Phase 4](../phase-4-delegation-jobs.md) (delegation + Jobs + observability) and the
[delegation rework](../phase-4-delegation-rework.md).

# Decisions

## North star & guiding principle

- **North star:** on a green build the Engineering Lead does **not** push to `main`. It **stages**
  the change as a reviewable diff (branch + PR), delegates a **`build-verification` Job** to the
  **QA Engineer**, waits for **gates + CI**, then asks the operator to **promote**. Anything wrong
  later is **rolled back** with one command. A promotion that touches the harness itself triggers a
  **controlled restart** that drains in-flight Jobs first.
- **Guiding principle (operator):** the Engineering Department should **run like a real software-
  building agency** — professional practices (real PRs, real review gates, real CI, clean
  revert-based rollback, controlled deploys/restart), not shortcuts.
- The advisory Code Review of Phase 4 is **upgraded** into one of several **promotion gates**.

## Promotion mechanism (D2) — PR-based

- **Stage** = push the build worktree as a branch (`feature/<slug>-<runId>`) + open a PR
  (`gh pr create`) with PRD + acceptance test + verification verdict in the body. The **PR diff is
  the staged diff** — a public, reviewable artifact ("GitHub is the build system of record").
- **Promote** = **merge the PR** to `main` after gates pass + operator YES.
- **Changes from before:** replaces today's `ship-implementation` direct `git push origin main`.
- Network/`gh` dependency accepted; isolated behind a runner and tested with a local bare repo (D10).

## Gating model (D3) — blocking, operator-overridable

- Each gate yields a structured pass/fail. Promotion is **blocked** unless **all gates are green**
  **or** the operator **explicitly overrides** a specific failing gate.
- Every override is **recorded** in the promotion ledger + telemetry (accountable, not reckless).
- Upgrades Phase 4's "advisory verdict" to "real gate with an accountable override."

## The gates & the QA Engineer (D4) — consolidated verification

- **One `qa-engineer` employee agent** (an upgrade of the Phase 4 Code Reviewer) owns all gates and
  returns **one composite verdict**. The EL delegates a single `build-verification` Job and folds
  the result into the D+ report → **one operator promotion blocker** (YES/NO + per-gate override).
- **Refinement (determinism ratchet):** the **ordering of the gate set is deterministic** → a
  **verification workflow** (fixed: CI → permission scan → code review → security review →
  aggregate) so gates **cannot be silently skipped**.
  - **Deterministic gates = tools:** **CI gate** (run the real validation suite — never let the LLM
    *claim* it passed) and **permission scan** (diff scanner for new dangerous capability).
  - **Judgment gates = skills:** **code review** and **security review** (distinct prompts → distinct
    findings, preserving separation of concerns inside one agent).
- **Authority:** the QA Engineer is an **employee** — it can *assess* but structurally **cannot**
  promote/ship/restart. The thing that judges cannot deploy.
- **Role, not a fixed unit:** "QA Engineer" is a role that **accretes more skills over time**
  (regression checks, acceptance verification, perf/accessibility, etc.). Verification gates are
  simply its first skills/tools.
- The Phase 4 `code-review` Job kind becomes a **gate within** the `build-verification` Job kind.

## CI integration (D7) — local gate + remote precondition

- **Pre-stage local CI gate:** the QA Engineer runs the same checks CI runs (lint/typecheck/build/
  test) against the worktree. Must pass to open the PR. Fast, deterministic, offline; feeds the
  verification report.
- **Remote CI precondition:** once the PR is open, **remote GitHub Actions must be green to merge**
  (read via `gh pr checks`), overridable per the blocking-with-override rule.

## Permission review (D8) — deterministic scan + thin judgment

- Scan the **staged diff** and flag capability/attack-surface expansion requiring explicit operator
  acknowledgement. Rule set (flag when the diff):
  - Adds/edits a **dangerous tool** (`DANGEROUS_TOOL_IDS`) or registers a **new tool** in
    `agentRegistry`.
  - **Escalates agent authority** (`employee → management`).
  - Adds/updates a **dependency** (`package.json`/lockfile).
  - Touches **security/CI rails**: `.github/workflows/**`, `.gitignore`, gitleaks config,
    `.env.example`, `AGENTS.md` dangerous list, `.cursor/rules/**`.
  - Introduces **shell exec, file deletion, network/external writes, or message-sending** patterns
    (heuristic).
- Output: a structured list of capability-affecting hunks → operator must acknowledge. A thin
  **skill** adjudicates only ambiguous heuristic hits (core stays deterministic).

## Rollback & promotion history (D5)

- **Rollback = `git revert`** of the promotion commit (forward-only history; **never** a force-push).
  Surfaced as `rollback #N` (dangerous → management + YES).
- **`promotionRegistry` / `PromotionRecord`** ledger (same pattern as `jobRegistry`/`JobRecord`)
  projecting over git: links `WorkItem`/`Issue` + the `build-verification` Job + the **promotion
  commit SHA** + which gates passed/were-overridden. Enables one-command rollback + an auditable
  ledger.

## Controlled restart flow (D6)

- `restart` gateway command (dangerous → management + operator YES) that **gracefully drains**:
  refuse new Jobs, finish/abort in-flight Jobs, flush telemetry, persist state, **exit cleanly** with
  a sentinel code.
- A **process supervisor** relaunches — **launchd** on the Mac mini (documented plist; alt
  `pm2`/wrapper). The harness does **not** restart itself in-process.
- After a promotion touching `src/**`, the EL **detects staleness and suggests** a restart (no
  auto-restart).
- **Chat lifecycle messages** (via the Phase 4 daemon→client bus): `🔄 Gateway restarting
  (draining N job(s))…` before exit; `⏳ Gateway is down, waiting…` while down (client auto-
  reconnects); `✅ Gateway back up` on reconnect, **including the version/commit SHA** as proof the
  new code is live.

## Docs flow (D9)

- **Docs ship directly (unchanged).** The new staging/promotion pipeline is **implementation-only**.
  `ship-docs` lands the PRD on `main` during planning → build → the **implementation PR references
  that PRD** and goes through staging/verification/promotion.

## Testing the north star (D10) — real mechanism, zero secrets

- **Fake remote = a local bare git repo** (`file://` origin) in a temp dir; real `git` exercises the
  actual stage → promote → **rollback (`git revert`)** path with no network/secrets.
- **`gh` behind a `GhRunner`** (mirroring the existing `GitRunner`) so PR-create/`pr checks`/merge
  are injectable; tests drive fake CI statuses (green/red/override).
- **Permission scanner** = pure function over a diff → deterministic unit tests.
- **QA verification machinery** = Phase 4-style integration test with a controlled model: gates run
  in order, composite verdict produced, blocking + per-gate override honored, telemetry emitted,
  promotion ledger written.
- **Restart** = test drain→exit with injected process control; assert the three lifecycle messages
  on the notification bus.
- **Local-only real eval** (optional, never in CI): real model + real `gh` PR against a throwaway
  repo, per the secret-handling rule.

## Approval gating & BL-003 overlap (D14) — Option C

- Phase 5 introduces three new dangerous actions (**promote**, **rollback**, **restart**) which
  overlap with **[BL-003] Runtime approval gating for dangerous capabilities** (#1).
- **Decision (Option C):** **reuse the existing simple YES/NO approval gate** for the three new
  actions, **but upgrade the gate to log every approval and denial** (with enough context to audit)
  to the run logs / telemetry. This satisfies BL-003's *audit* + *enforced-not-just-documented*
  criteria for the actions Phase 5 cares about.
- **Not in Phase 5:** general capability coverage for the rest of the AGENTS.md dangerous list
  (shell exec, dependency install, file deletion, secrets access, arbitrary external writes). That
  remains in a **shrunken BL-003** for a later dedicated pass.
- Rationale: accountability matches the "professional agency" north star and the "observability
  expands with capability" rule, and dovetails with the promotion ledger's override logging — for
  little extra scope. Building the full system now (Option B) would violate thin-vertical-slice.

## Rejection & remediation — the red/no path (D15)

What happens when verification is **red** (a gate fails, not overridden) or the operator says **NO**.

- **Core behavior (D15a):** the change is **not promoted and not discarded**. The QA Engineer's
  structured **findings** are handed back to the **Engineering Lead**, which drives a
  **remediation loop** (fix → re-verify). The staged **PR stays open as a draft** while red and
  accumulates fix commits (not closed/recreated).
- **Who fixes (D15b):** the **Engineering Lead owns remediation** in Phase 5 — it re-runs the build
  with the findings injected as remediation context, then re-submits for verification. A dedicated
  **Debugger sub-agent is deferred** (Phase 5b/later).
- **Operator NO routes (D15c):** a NO is conversational and routes to one of **four** outcomes:
  - **fix it** (default) → EL remediation loop, with whatever the operator flagged added to findings.
  - **change the spec** → back to grill / re-PRD (requirements problem, not code).
  - **park / return to backlog** → set aside, work preserved, resumable later.
  - **abandon** → close PR, mark WorkItem `abandoned` (won't do).
- **Parked semantics (D15d):** new `parked` stage (distinct from `abandoned` = "will revisit" vs
  "killed"). Branch kept; **PR kept open but converted to draft + `parked` label** (diff stays
  visible, low-friction resume). Issue stays **open** and moves to the **Backlog** column on the
  project board. Resumable via the existing `resume #N` / `list` flow.
- **Loop cap (D15e):** **max 3** fix→re-verify attempts per WorkItem (**configurable** via
  config/`.env`, not hardcoded). Each attempt is **operator-visible** and runs from **fresh context +
  structured findings** (no transcript pile-up — fights LLM looping/context bloat). When the cap is
  hit, the EL **hard-stops the auto-loop and escalates to the operator** with a summary of attempts +
  remaining findings, and moves the WorkItem to **`blocked`**. Attempt count recorded in the Job +
  telemetry.
- **Light triage before looping (D15f):** the EL makes one cheap judgment from the findings before
  spending the loop:
  - **code-level / fixable** (CI fail, review nit, simple bug) → enter the fix loop (up to cap).
  - **spec / requirements gap or ambiguous** → **escalate immediately** (suggest re-spec); don't
    burn loop attempts on a problem code can't solve.
  - **security / permission findings** → **always surfaced to the operator**, never silently
    auto-fixed away.
- **New WorkItem states (D15g):** add **`staged`** (build green, PR open, verification running),
  **`blocked`** (cap hit / needs operator decision), **`parked`** (set aside, resumable). Promotion
  success stays `done`; `abandoned` unchanged. Each fix→re-verify cycle creates new Jobs under the
  WorkItem.

## Documentation artifacts (D12)

- **ADR 0007 — PR-based staging, promotion & rollback model** (supersedes direct-push).
- **ADR 0008 — QA Engineer verification model** (consolidated gates as a deterministic verification
  workflow; employee authority can assess but not promote).
- Controlled restart stays **operational** in the north-star doc (no separate ADR).
- New `CONTEXT.md` nouns: **Staging / staged change**, **Gate**, **QA Engineer**, **Promotion**,
  **PromotionRecord / promotionRegistry**, **Rollback**; new **Job kind** `build-verification`.

## Delivery slices (D11, ordered — prove the loop first, then layer gates)

0. **Chore:** ADR 0007 + 0008; `CONTEXT.md` vocabulary; rename `code-reviewer` → `qa-engineer` in
   the registry.
1. **Staging + PR promotion + rollback:** `GitRunner`/`GhRunner`, stage = branch+PR, promote =
   merge, `git revert` rollback, `promotionRegistry`/`PromotionRecord` ledger. Replaces direct-to-
   main `ship-implementation`. Proven against the bare-repo fake remote — *before all gates exist*.
2. **QA Engineer + first gates:** upgrade Code Reviewer → QA Engineer running the deterministic
   verification workflow with **CI gate (local) + code review**; composite `build-verification` Job;
   EL folds into D+ report → single operator promotion blocker (with override). Includes the
   **remediation loop core** (red → findings → EL fix → re-verify; cap 3 + fresh context; light
   triage; `staged`/`blocked` states) and **approval-audit logging** on the gate (Decision C).
3. **Remaining gates:** add **security-review** skill + **permission-scan** tool; wire **remote CI
   precondition** (`gh pr checks`).
4. **Rollback & ledger UX + NO routing:** `rollback #N`, `promotions` / `promotion #N`; the four NO
   routes (fix / re-spec / **park** / abandon) and the `parked` state (draft PR + label + backlog).
5. **Controlled restart:** drain → clean exit → launchd/supervisor relaunch + the 3 chat lifecycle
   messages (+ launchd doc).
6. **North-star verification:** CI machinery tests + optional local real eval.

# Open questions resolved

- North-star framing → stage → QA-verify → CI → operator-approved promote → rollback → restart; act
  like a professional agency. **Yes.**
- Promotion mechanism → **PR-based** (stage = PR, promote = merge), not direct-to-main.
- Gate strictness → **blocking by default, operator-overridable, override logged.**
- Gate set → **CI + code review + security + permission**, all in, thinnest-first.
- Gate architecture → **one QA Engineer employee agent** running a **deterministic verification
  workflow** (tools for deterministic gates, skills for judgment gates); one composite
  `build-verification` Job; single operator blocker.
- Verifier naming → **QA Engineer** (role that grows more skills over time).
- Rollback → **`git revert` + `promotionRegistry`/`PromotionRecord` ledger.**
- CI → **local CI gate to open PR + remote GitHub Actions green to merge** (overridable).
- Permission review → **deterministic diff scan** (full rule set) **+ thin judgment** for ambiguous.
- Docs flow → **docs ship directly**; pipeline is implementation-only.
- Restart → **graceful drain + clean exit + launchd/supervisor relaunch**, EL suggests on `src/**`
  promotions, + **three chat lifecycle messages** (down/up/back-with-SHA).
- Testing → **local bare-repo fake remote + `GhRunner`** + deterministic gate/scanner/restart tests
  + optional local real eval.
- ADRs → **two** (0007 promotion model, 0008 QA Engineer); restart documented in the north-star doc.
- Approval gating / BL-003 overlap → **Option C**: reuse the simple gate for promote/rollback/restart
  but **log approvals + denials**; full capability coverage stays in a shrunken BL-003.
- Red/NO path → **kicked back to the EL** with findings (not promoted, not discarded); PR stays open
  as draft; **four NO routes** (fix / re-spec / park / abandon); **EL owns remediation**; **light
  triage** then fix loop; **cap 3** then escalate → `blocked`; new states `staged`/`blocked`/`parked`.

# Out of scope (→ Phase 5b / later)

- Multi-environment staging / canary / blue-green deploys.
- Auto-merge / fully autonomous promotion without operator approval (human-in-the-loop stays).
- Splitting **Security** into its own independent agent (security stays a QA Engineer skill for now;
  separable later — reversible).
- Broader QA skills (regression suites, perf/accessibility/load testing).
- Standalone **DevOps Agent** role (init.md Phase 3 deferral remains).
- Hard-blocking gates with **no** override.
- Cross-process pubsub (`UnixSocketPubSub`/Redis) — still deferred from Phase 4.
- Self-healing / automatic rollback on post-promotion failure detection.
- Dedicated **Debugger sub-agent** (EL owns remediation in Phase 5).
- Smarter automated triage/classification beyond the EL's light judgment.
- Automated re-spec (the re-spec route just loops back to the existing grill/PRD flow).
- Full BL-003 capability coverage (shell exec, dependency install, file deletion, secrets access,
  arbitrary external writes) — remains in shrunken BL-003.
