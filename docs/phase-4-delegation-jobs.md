# Phase 4: Sessions, Delegation, and Job System (north star)

This document captures the **operator-aligned** Phase 4 plan for MichaelOS, synthesized from the grill
session on 2026-06-27 ([grill notes](./prds/phase-4-delegation-jobs.grill.md)). It builds on
[Phase 3](./phase-3-engineering-department.md) (Engineering Department complete) and realizes the
init.md Phase 4 goal: **allow bounded delegation with full observability**.

**Status:** planned.

## North star user story

> As the operator, I describe work to the **Engineering Lead**. When a step needs a specialist, the
> Lead does not do it inline — it **delegates a bounded task to a sub-agent as a tracked Job**. The
> Job runs in its own thread/context, returns a **structured result**, and is **fully traceable**.
> The first real delegation is the **Code Reviewer**: on a green build the Lead *itself decides* the
> code needs review, delegates it, receives a structured verdict, and folds it into my D+ report. I
> can inspect every Job (`jobs` / `job #N`) and the whole system is observable enough that, later, an
> automated agent could read the traces, run evals, and pinpoint exactly what went wrong and why.

Phase 4 turns the department's inline tool calls into **real agentic delegation** with a **job
system** and a **foundational observability substrate** the rest of the project will lean on.

## Core principle: framework-first

Before building any custom primitive (queue, store, scheduler, eventing, delegation), check the
framework docs and the **installed** version first. This grill did exactly that and found
`@mastra/core@1.46.0` already ships most of the machinery, so we **reuse Mastra and keep a thin
domain layer** rather than hand-rolling a worker + DB.

| Phase 4 need | Mastra primitive (installed) | What we still own |
|--------------|------------------------------|-------------------|
| Delegation (EL → sub-agent) | **Supervisor agents** (`agents`, `onDelegationStart/Complete`, memory isolation, structured output) | Delegation intent in EL instructions; clearance rules |
| Async / queue / durability | **Background tasks** (`backgroundTaskManager`, evented runs, durable suspend/resume) | Job *semantics* (kind, parent linkage) |
| Events / monitoring | **PubSub** (`EventEmitterPubSub`) + task stream | Daemon→client forwarding + headlines |
| Persistence | **LibSQL** store | `jobRegistry` projection table |
| Tracing / evals | **observability / telemetry / evals / scores** modules | Domain JSONL + correlation IDs + eval-ready records |

> `.network()` is deprecated in Mastra — **supervisor agents** are the delegation pattern.

## The three nouns (Issue / WorkItem / Job)

```
GitHub Issue  #17        ← public identity / bookmark (GitHub, system of record)
      │ 1:1
   WorkItem  "<slug>"     ← private feature lifecycle (stateDir, gitignored)
      │ 1:many
   Job: "code-review build <hash>"  → delegatedTo: code-reviewer, output: {verdict, findings}
```

- **Issue** and **WorkItem** are 1:1 but deliberately **separate** — public identity vs private
  runtime state (the public-safe boundary). They are not merged.
- **Job** is the new noun: one **bounded, delegated, traced** task under a WorkItem. Many per
  WorkItem. It records *who* did it (`delegatedTo`), *what it got* (`input`), *what it returned*
  (`output`), and its *trace* (`mastraRunId`/`traceId`).

Definitions are recorded verbatim in [`CONTEXT.md`](../CONTEXT.md).

## Architecture

```mermaid
flowchart TB
  OP[Operator] <--> CLIENT["thin chat client"]
  CLIENT <--> DAEMON["always-on gateway daemon"]
  DAEMON <--> EL["Engineering Lead (supervisor agent)"]
  DAEMON -.->|"forwards job headlines"| CLIENT
  EL -->|"delegates (supervisor)"| REV["Code Reviewer (employee)"]
  EL -->|"enqueue Job"| BG["Mastra background tasks (evented, durable)"]
  BG --> REV
  REV -->|"structuredOutput: ReviewVerdict"| EL
  EL -->|"D+ report incl. verdict"| OP

  subgraph obs [Observability substrate]
    TRACE["Mastra AI tracing → LibSQL (queryable)"]
    JSONL["domain JSONL → .logs/"]
    REDACT["redaction-before-persist"]
  end
  EL -.-> obs
  REV -.-> obs
  BG -.-> obs

  subgraph store [LibSQL .mastra/ (gitignored)]
    JOBS["jobRegistry / JobRecord (projection over runs)"]
    RUNS["Mastra run + memory state"]
  end
  BG --> store
  JOBS -. "links Issue/WorkItem ↔ mastraRunId" .- RUNS
```

The EL stays the sole front door. Delegation is a capability the EL **wields**, not a hard-coded
branch. Each Job runs in its own memory thread (supervisor memory isolation).

## Decisions (grill session 2026-06-27)

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | North star | EL delegates a bounded, traced **Job**; first delegate = Code Reviewer | Prove delegation + jobs + observability on an existing agent |
| 2 | Nouns | Keep **Issue / WorkItem / Job** distinct; document in `CONTEXT.md` | Public identity vs private lifecycle vs delegated task |
| 3 | Build vs reuse | **Framework-first** — reuse Mastra; thin domain layer only | Don't hand-roll worker/DB Mastra already ships; new `framework-first` rule |
| 4 | Delegation | **Mastra supervisor agents** (not `.network()`, not custom tool) | Current recommended pattern; hooks + memory isolation |
| 5 | Execution | **Async via Mastra background tasks**; no custom worker/queue | Durable, evented, crash-resilient out of the box |
| 6 | Job store | **`jobRegistry`/`JobRecord` projection over Mastra runs** in LibSQL | Owns domain semantics; not a competing engine |
| 7 | Trigger | EL **auto-delegates review on green** via `streamUntilIdle` | Agentic feel; folds verdict into D+ report; non-blocking |
| 8 | Guardrail | **No forcing guardrail**; non-correcting **`review.missing`** signal | Test real delegation, not a deterministic fallback; detect, don't paper over |
| 9 | Authority | **Verdict advisory**; operator YES still ships | Trust model unchanged this phase |
| 10 | Observability | **Foundational first slice**: capture≠surface, verbosity dial, dual sink, correlation IDs, **mandatory redaction**, retention | Leveraged project-wide; enables future evals + health-check |
| 11 | Storage privacy | Trace store `.mastra/`, JSONL `.logs/` — gitignored, never committed | Public-safe; redaction is defense-in-depth |
| 12 | Job I/O | **Generic envelope + per-kind zod payload** via Mastra `structuredOutput`; retire hand-parsing | Uniform records; typed results; eval-ready |
| 13 | Notification | **Daemon subscribes + forwards headline** to thin client | Single in-process pubsub; client stays dumb |
| 14 | Inspection | `jobs` / `job #N` gateway commands | Mirror `list` / `resume #N` |
| 15 | Dangerous tools | **Clearance-gated**: only "management" (EL) may use them, with YES; "employees" cannot | Authority-based, testable, reversible |
| 16 | Evals | **Eval-ready now; one north-star delegation eval in scope**; broader scorers deferred | Verify the metric without building eval library |
| 17 | Scope | Necessity Reviewer + multi-route chat → **Phase 4b** | Keep this chunk focused |

## Testing the north star (honoring zero-secret CI)

- **CI (deterministic, no secrets):** integration test of the **delegation machinery** with a
  controlled model — supervisor delegates → background Job created → Code Reviewer runs →
  `structuredOutput` verdict → telemetry (`job.delegated`/`job.completed`) → verdict in report. Tests
  that *when the agent delegates, the agentic plumbing works*.
- **Local-only (real model):** an **eval** asserting the EL *chooses* to delegate the review on a
  green build, verified **via observability** (the trace shows the delegation). This is the genuine
  north-star behavioral metric; live LLM calls are local-only per the secret-handling rule.

## Delivery slices (thin vertical, ordered)

### Slice 0 (chore) — Framework-first rule + vocabulary
- `.cursor/rules/framework-first.mdc` (always-applied) + `AGENTS.md` pointer.
- `CONTEXT.md` definitions for **Issue / WorkItem / Job** (+ **Trace** vocabulary).

### Slice 1 — Observability substrate (foundational)
- Unified, versioned event/trace schema with correlation IDs.
- Dual sink: Mastra AI tracing → LibSQL (queryable) + domain JSONL → `.logs/`.
- `OBSERVABILITY_LEVEL` verbosity dial (default standard; crankable to full fidelity).
- **Mandatory redaction-before-persist** (tested: known secret/PII patterns never hit disk).
- Retention/rotation + optional sampling.
- **Acceptance:** at max level, agent/tool inputs+outputs, model/tokens/latency/cost, and errors+stack
  are captured, correlated, redacted, and queryable; gitignored storage only.

### Slice 2 — Job system
- `src/engineering/jobRegistry.ts` (`JobRecord` envelope + kind→zod-payload map) as a projection over
  Mastra runs in LibSQL.
- Mastra background tasks for execution/durability.
- `jobs` / `job #N` gateway commands.
- **Acceptance:** a delegated task persists a `JobRecord` linked to its WorkItem/Issue and `mastraRunId`,
  with status lifecycle and typed `(input, output)`.

### Slice 3 — Agentic delegation (Code Reviewer as first Job)
- EL becomes a **supervisor** with Code Reviewer as a subagent (`authority: "employee"`).
- Auto-delegate review on green via `streamUntilIdle`; verdict via `structuredOutput`
  (retire `extractJsonFromText`); fold into D+ report; manual `review #N`.
- Non-correcting `review.missing` signal; clearance-gated dangerous tools.
- Daemon forwards job-completion headlines to the client.
- **Acceptance:** green build ⇒ EL delegates ⇒ `JobRecord` + verdict + telemetry + report; verdict advisory.

### Slice 4 — North-star verification
- CI machinery integration test (controlled model, zero secrets).
- Local-only real-model delegation eval reading observability.

## In scope (Phase 4)
- Framework-first rule; Issue/WorkItem/Job vocabulary.
- Observability substrate (foundational).
- Job system (`jobRegistry`/`JobRecord` over Mastra runs).
- Agentic delegation via supervisor agents (Code Reviewer first Job).
- Clearance-gated dangerous tools.
- Generic structured job I/O via Mastra `structuredOutput`.
- `jobs`/`job #N` inspection + daemon-forwarded notifications.
- One north-star delegation eval (local-only) + CI machinery test.

## Out of scope (→ Phase 4b / later)
- Necessity Reviewer (Ponytail) — second delegate / job kind.
- Multi-route gateway / direct operator→agent chat.
- Human-in-the-loop "employee raises a question to the operator" + multi-channel; operator's upgraded
  delegation system.
- Generalized expected-outputs checklist / invariant tracker (investigate Mastra task-completion
  scorers first).
- Broader scorer/eval library + cron health-check / self-healing debugger agent.
- Hard (blocking) review gating; cross-process pubsub (`UnixSocketPubSub`/Redis).

## Phase 4 complete when
- [ ] Observability substrate captures correlated, redacted, queryable traces with a verbosity dial; storage is gitignored.
- [ ] A delegated task is persisted as a `JobRecord` (envelope + typed payload) linked to WorkItem/Issue and `mastraRunId`.
- [ ] EL (supervisor) auto-delegates the Code Reviewer on green; verdict (advisory) appears in the D+ report.
- [ ] `review.missing` fires when a ship prompt is reached with no review job (detection only).
- [ ] Dangerous tools are clearance-gated to "management"; employees structurally cannot use them.
- [ ] `jobs` / `job #N` work; daemon forwards completion headlines to the client.
- [ ] CI tests the delegation machinery (controlled model); a local-only eval verifies the EL *chooses* to delegate.
- [ ] `framework-first` rule + `CONTEXT.md` definitions committed.
- [ ] This north star doc exists and is current.

## Related
- [docs/phase-3-engineering-department.md](./phase-3-engineering-department.md)
- [grill notes](./prds/phase-4-delegation-jobs.grill.md)
- [CONTEXT.md](../CONTEXT.md)
- [init.md Phase 4](../init.md)
- Mastra: supervisor agents, background tasks, pubsub, observability (installed `@mastra/core@1.46.0`)
