# Objective

Define the decisions and scope for **Phase 6.5: Steerable Engineering Loop** — migrate engineering
from one-shot fire-and-forget builds to a **steerable, observable, resumable plan→build loop**
driven entirely from the gateway. Synthesized from the grill session on 2026-06-28. Builds on
[Phase 6](./phase-6-skill-platform.md) (skills platform) and the north star at
[docs/phase-6.5-steerable-loop.md](../phase-6.5-steerable-loop.md).

**Pivotal SDK finding:** `@cursor/sdk` v1.0.22 exposes native `AgentModeOption = "agent" | "plan"`
on `AgentOptions.mode` and `SendOptions.mode`, plus `createPlan` / `updateTodos` tool calls surfaced
via `run.stream()`. Plan and build run on the **same durable `Agent` instance** so plan-turn research
carries into execution. See [ADR 0011](../adr/0011-steerable-builds-plan-and-slice.md) and
[ADR 0012](../adr/0012-cursor-comprehension-mode.md).

# Decisions

## D1 — One-shot fallback flag

- Env `CODING_EXECUTOR_MODE` → `AppConfig.codingExecutorMode`: `durable` (default) | `one-shot`.
- Durable becomes default the moment slice 1 lands; one-shot is the explicit rollback path.

## D2 — CodingExecutor seam evolution

- Add **`DurableCodingExecutor`** (`startSession` / `send` / `resume` / `cancel` / `stream`) alongside
  the existing one-shot `CodingExecutor`.
- `CursorExecutor` stays the one-shot fallback; new `DurableCursorExecutor` wraps
  `Agent.create` / `send` / `resume` / `cancel`.
- Both live behind the one seam module in `src/agentBuild/`.

## D3 — Orchestration home

- Deterministic **`steerableBuild` driver** in `src/agentBuild/`, invoked by new EL tools:
  `plan-build`, `dispatch-slice`, `build-status`, `interrupt-build`.
- Checklist persisted to WorkItem `stateDir`; EL supplies judgment via tool calls; driver is mechanism.

## D4 — Interrupt + stream model

- Build sends run **non-blocking**; progress + todo/slice updates stream via `broadcastToClients`.
- Daemon recognizes out-of-band `stop` / `cancel` while a build is in-flight → `run.cancel()` +
  corrective `send`.

## D5 — Clarifying questions (plan mode)

- Auto-answer from PRD/Issue/comprehension with "make reasonable assumptions and state them" (logged).
- Escalate to operator (approval-style gateway prompt) only when plan mode cannot proceed or after
  1 unresolved blocking question.

## D6 — Per-slice verification

- Between slices: `typecheck` + `lint` + targeted tests in the worktree.
- Terminal gate: hash-locked acceptance + preflight at the end only.

## D7 — Telemetry namespaces

- `build.*`: `session_started`, `plan_captured`, `slice_dispatched`, `slice_verified`, `interrupted`,
  `resumed`, `clarification`.
- `comprehension.*`: `invoked`, `cite_verified`, `cite_failed`.
- `pr.feedback_ingested`.

## D8 — Operator visibility

- Gateway commands: `builds` (list active/recent durable sessions) and `build <id>` (checklist progress
  + changed-files/diff summary), backed by `Agent.list` / `Agent.get`.

## D9 — Session-scoped approval (minimal)

- Operator can pre-authorize `dispatch-slice` for the duration of **one build** (durable session).
- Expires on build finish/cancel/restart. Ship/promote/restart still per-call YES.

## D10 — Comprehension consumers (6.5)

- Engineering Lead (planning/integration-mapping) + Skill Engineer (reuse check before
  `request-tool-build`). Debugger / Engagement Manager deferred to Phase 4b/4c.

## D11 — PR/CI ingestion

- On-demand EL tool `ingest-pr-feedback` via `gh` (comments + checks), normalized into a corrective
  slice for the durable session.

## D12 — In-loop inspection scope

- `read-worktree-file`, `rerun-test`, `tail-build-log` operate on the **current build's worktree**;
  read-only, employee authority.

## D13 — Restart-survival

- SDK `LocalAgentStore` at gitignored `.mastra/`; persist `cursorAgentId` on WorkItem;
  `resume-work-item` / `builds` call `Agent.resume(agentId)` to reattach + re-stream.

## D14 — Cite-and-verify depth

- Verify each cited path exists AND each cited symbol is grep-found; advisory (failures surfaced, not
  auto-rejected).

## D15 — Model

- `defaultCodingModel` (composer-2.5) for plan + comprehension turns.

# Open questions (resolved)

All grill questions resolved in session; no open blockers for implementation.
