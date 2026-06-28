# Objective

Ship Phase 4: **bounded agentic delegation with full observability** — the Engineering Lead delegates
tracked Jobs to sub-agents (Code Reviewer first), backed by a foundational observability substrate and
a thin `jobRegistry` projection over Mastra runs.

# Background

Phase 3 delivered the Engineering Department (registry, Code Reviewer, always-on gateway, resume→ship).
Phase 4 turns inline tool calls into **real agentic delegation** with durable Jobs, correlated
telemetry, and eval-ready records. See [phase-4 north star](../phase-4-delegation-jobs.md) and
[grill notes](./phase-4-delegation-jobs.grill.md).

# Requirements

## Observability substrate (Slice 1)
- `OBSERVABILITY_LEVEL` dial (silent|minimal|standard|verbose|debug), default standard.
- Unified versioned event schema with correlation IDs (`traceId`→`sessionId`→`workItem`/`issueNumber`→`jobId`→`mastraRunId`).
- Dual sink: domain JSONL → `.logs/` + trace rows → `.mastra/` (gitignored).
- **Mandatory redaction-before-persist** (secrets/PII never hit disk).
- Retention/rotation for logs.

## Job system (Slice 2)
- `JobRecord` envelope + per-kind zod payload (`code-review` → `reviewVerdictSchema`).
- `jobRegistry` in `.mastra/jobs.db` (LibSQL), projection linked to Mastra `mastraRunId`.
- `jobRunner` over Mastra `backgroundTaskManager` (async, durable).
- Gateway commands: `jobs`, `job #N`.

## Agentic delegation (Slice 3)
- EL as **supervisor** with Code Reviewer subagent.
- Auto-delegate review on green via agentic path; `stream({ untilIdle: true })` folds verdict into D+ report.
- Mastra `structuredOutput` for verdict (retire hand-parsing).
- `review.missing` detection signal (non-correcting).
- `authority: management | employee` on `AgentRegistration`; dangerous tools only for management.
- Daemon forwards job-completion headlines to connected clients.

## Verification (Slice 4)
- CI integration test: delegation machinery with controlled model (zero secrets).
- Local-only `npm run eval:delegation`: real EL chooses to delegate (observability assertion).

# Acceptance Criteria

- [ ] Observability captures correlated, redacted events; verbosity dial works; storage gitignored.
- [ ] Delegated task persists as `JobRecord` linked to WorkItem/Issue and `mastraRunId`.
- [ ] EL delegates Code Reviewer on green; advisory verdict in D+ report.
- [ ] `review.missing` fires when ship reached without review job.
- [ ] Dangerous tools clearance-gated to management agents.
- [ ] `jobs` / `job #N` work; daemon forwards completion headlines.
- [ ] CI machinery test passes; local eval script documented.
- [ ] `framework-first` rule + CONTEXT.md definitions committed.

# Technical Notes

- Reuse Mastra `@mastra/core@1.46.0`: supervisor agents, background tasks, LibSQL storage.
- Thin anti-corruption wrappers in `src/engineering/jobRunner.ts`, `src/observability/`.
- Harness-internal work ships via Cursor/operator to `main`, not through `agent:build`.

# Out of Scope

Phase 4b: Necessity Reviewer, multi-route chat, raise-to-operator HITL, generalized checklist, broader evals, hard review gating.

# Verification Commands

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run eval:delegation` (local-only, requires API keys)
