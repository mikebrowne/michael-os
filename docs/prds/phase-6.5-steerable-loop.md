# Objective

Ship Phase 6.5: the **Steerable Engineering Loop** — migrate the coding executor from one-shot
`Agent.prompt` to a **durable Cursor session** (`Agent.create` / `send` / `resume`) with native
**plan mode** for the plan turn and **agent mode** for bounded slice execution, so engineering runs
**grill → plan → sliced build → verify → promote** entirely from the gateway with operator steering
and observation — no IDE. See
[Phase 6.5 north star](../phase-6.5-steerable-loop.md),
[grill notes](./phase-6.5-steerable-loop.grill.md),
[ADR 0011](../adr/0011-steerable-builds-plan-and-slice.md),
[ADR 0012](../adr/0012-cursor-comprehension-mode.md).

# Requirements

## Slice 1 — Durable executor

- Add **`DurableCodingExecutor`** interface + **`DurableCursorExecutor`** over `Agent.create` /
  `send` / `resume` / `cancel` / `stream`; store at gitignored `.mastra/`.
- Keep one-shot `CursorExecutor` behind `CODING_EXECUTOR_MODE` (`durable` default | `one-shot`).
- `runAgentBuild` branches on `config.codingExecutorMode`.
- **Verify + record** plan-mode file-write behavior in ADR 0011.
- Tests for both modes (mock SDK).

## Slice 2 — Plan-and-slice

- **`steerableBuild` driver** captures `createPlan` markdown as EL-owned checklist (persist to
  `stateDir`); dispatches one slice per `send({ mode: "agent" })`.
- Per-slice verify: typecheck + lint + targeted tests; full acceptance + preflight at end.
- EL tools: `plan-build`, `dispatch-slice`, `build-status`.
- Clarifying-question assume-then-escalate loop.

## Slice 3 — Stream + interrupt

- Pump `run.stream()` / `onStep` (`updateTodos`, progress) to `broadcastToClients`.
- Non-blocking build sends; daemon handles out-of-band `stop` / `cancel` → `run.cancel()` +
  corrective `send`.
- `interrupt-build` tool.

## Slice 4 — In-loop inspection

- Read-only employee tools: `read-worktree-file`, `rerun-test` (`vitest run <file>`),
  `tail-build-log` scoped to current build worktree/run dir.

## Slice 5 — Comprehension mode

- Read-only capability on seam (`mode: "plan"` + disposable worktree).
- `comprehend` tool + cite-and-verify (path exists + symbol grep).
- Wired to Engineering Lead + Skill Engineer; "when to invoke" Skill.

## Slice 6 — PR / CI ingestion

- `ingest-pr-feedback` tool (`gh` comments + checks) normalized into corrective slice.

## Slice 7 — Operator visibility

- Gateway `builds` + `build <id>` via `Agent.list` / `Agent.get` + worktree diff summary.

## Slice 8 — Session-scoped approval (minimal)

- Pre-authorize `dispatch-slice` for one build in approval gate; expires on build end/cancel/restart.

# Acceptance Criteria

- [ ] `DurableCodingExecutor` + one-shot fallback behind `CODING_EXECUTOR_MODE`; durable is default.
- [ ] Plan-mode write behavior documented in ADR 0011; disposable worktree remains hard guarantee.
- [ ] `steerableBuild` captures `createPlan` checklist; one slice per send; per-slice verify gates run.
- [ ] Build progress streams to gateway; `stop`/`cancel` interrupts in-flight slice; corrective send works.
- [ ] In-loop inspection tools read worktree / re-run test / tail log without leaving gateway.
- [ ] Comprehension mode cite-and-verify (path + symbol) on EL + Skill Engineer.
- [ ] `ingest-pr-feedback` pulls PR comments + CI failures as loop inputs.
- [ ] `builds` / `build <id>` commands show session status + diff summary.
- [ ] Session-scoped `dispatch-slice` approval for one build; ship/promote still per-call YES.
- [ ] All `build.*`, `comprehension.*`, `pr.feedback_ingested` telemetry events emitted.
- [ ] Gateway restart reattaches via `Agent.resume` + persisted `cursorAgentId`.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` green.

# Technical Notes

- **Framework-first:** SDK behind thin anti-corruption seam in `src/agentBuild/`; Mastra for EL/tools.
- **Public-safe:** `CURSOR_API_KEY` via env; durable store + state in gitignored `.mastra/`.
- **Authority:** implementation = management; comprehension + inspection = employee.
- **Naming:** `steerableBuild`, `buildTelemetry`, `DurableCodingExecutor` — domain-qualified.

# Out of Scope

- Full approval policy engine (Phase 7).
- Rich web dashboard beyond minimal status surface.
- Debugger / Engagement Manager comprehension wiring (Phase 4b/4c).

# Verification Commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
