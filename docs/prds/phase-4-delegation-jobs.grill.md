# Objective

Define the decisions and scope for **Phase 4: Sessions, Delegation, and Job System** — *bounded delegation with full observability*. The north star: the **Engineering Lead delegates a bounded, traced job to a sub-agent**, with the **Code Reviewer as the first delegated job**. Necessity Reviewer and multi-route chat ride on top later (Phase 4b).

# Decisions

## North star & nouns

- **North star:** EL (supervisor) delegates a bounded sub-task as a tracked **Job**; the job runs in its own thread/context, returns a **structured result**, and is **fully traceable**. First delegate = the existing Code Reviewer.
- **Three nouns, kept distinct** (documented in `CONTEXT.md`):
  - **GitHub Issue** — public identity / bookmark of a feature (on GitHub). `Issue 1:1 WorkItem`.
  - **WorkItem** — private feature-lifecycle state machine (`stateDir`, gitignored). `WorkItem 1:many Jobs`.
  - **Job** — one bounded, delegated, traced task under a WorkItem (who/what-in/what-out/trace).
  - Issue and WorkItem are intentionally split by the public-safe boundary (public identity vs private runtime state); not merged.

## Framework-first (lean on Mastra)

- **Adopt Mastra primitives over hand-rolling**, verified present in installed `@mastra/core@1.46.0`:
  - **Delegation** → **supervisor agents** (subagents on `agents`, `onDelegationStart`/`onDelegationComplete`, memory isolation, structured output). `.network()` is deprecated; do not use.
  - **Async / queue / durability** → **background tasks** (`backgroundTaskManager`, evented workflow runs, durable suspend/resume snapshots in LibSQL). No custom worker loop / claim-heartbeat.
  - **Events / monitoring** → **PubSub** (`EventEmitterPubSub` in-process) + background-task stream.
  - **Persistence** → existing **LibSQL** store.
- **Thin domain layer we still own:** `jobRegistry` + `JobRecord` as a **projection over Mastra runs** (links our nouns: Issue/WorkItem ↔ `mastraRunId`), reusing LibSQL. Not a competing execution engine.
- **Anti-corruption wrapper:** Mastra calls sit behind our own delegation/job module so version churn is a localized edit (reversibility).
- **New rule:** `framework-first.mdc` (always-applied) — check framework/library docs + installed version before building a custom primitive; only hand-roll when the framework genuinely lacks it, and document the gap.

## Execution model

- **Async background execution via Mastra** (not synchronous, not a custom worker). "Get it right early."
- Code-review job **auto-delegated by the EL on green build** (agentic decision, supervisor pattern), using `streamUntilIdle` so it *feels* synchronous in the normal flow (EL waits, folds verdict into the D+ report) while remaining a real background job (traced, persisted, non-blocking, abortable). Manual `review #N` re-run supported.
- **No deterministic "forcing" guardrail** — that would mask whether the agent actually delegated and would test the wrong thing. Instead a **non-correcting `review.missing` detection signal** fires if a ship prompt is reached with no review job (detect, don't paper over). This is a deliberately **specific, one-off signal — not the generalized solution**.
- Review verdict stays **advisory** (operator YES still ships); hard gating remains deferred.

## Observability & telemetry (foundational, first slice)

- Treated as **project-wide foundational infra**, built early to a high bar.
- **Separate capture from surface:** capture at high fidelity; control what is surfaced/retained via a **verbosity dial** (`OBSERVABILITY_LEVEL`, default standard, crankable to full-fidelity via config, no code change).
- **Two layers:** Mastra **AI tracing** (execution spans) + extended domain **JSONL** (`engineeringTelemetry`) with job-scoped events (`job.created/delegated/started/completed/failed`).
- **Correlation IDs threaded everywhere:** `traceId` → `sessionId` → `workItem`/`issueNumber` → `jobId` → `mastraRunId` → step/tool spans.
- **Machine-consumable + queryable:** Mastra tracing persisted to LibSQL (SQL-queryable) for a future agent to diagnose; JSONL for humans; correlated by IDs.
- **Content capture at max:** inputs/outputs, model/params, tokens/latency/cost, delegation decisions, structured results, errors + stack.
- **Mandatory redaction-before-persist** (hard requirement, tested): no raw secrets/PII hit disk even at max verbosity.
- **Retention/rotation** + optional sampling so max fidelity doesn't fill the disk.
- **Storage is local-only:** trace store in `.mastra/`, JSONL in `.logs/` — both gitignored, never on GitHub. Redaction is defense-in-depth on top.
- **Eval-ready, evals deferred:** every Job is a self-contained `(input, output)` tuple a future scorer can grade. The broader scorer library + health-check/debugger agent are deferred — but the **one north-star delegation eval** is in Phase 4.

## Job I/O contract

- **Generic `JobRecord` envelope + per-kind typed payload.** Envelope: `id`, `kind`, `parentWorkItem`, `issueNumber`, `delegatedTo`, `status`, `input`, `output`, `error?`, timings, `mastraRunId`, `traceId`.
- **kind→zod-schema map**; first payload = existing `reviewVerdictSchema`.
- Produce structured output via Mastra **`structuredOutput`**; **retire** the brittle hand-parsing (`extractJsonFromText`/`parseReviewVerdict`), keep `reviewVerdictSchema` + `formatReviewVerdictReport`.

## Notification & inspection

- Daemon/client split: **daemon subscribes to Mastra events and forwards a formatted headline** to the thin chat client (single in-process pubsub; client stays dumb). `UnixSocketPubSub`/Redis deferred.
- Gateway commands: **`jobs`** (list active/recent) and **`job #N`** (detail: input, structured output, error, timing, threadId), mirroring `list`/`resume #N`.

## Safety / authority

- **Dangerous tools gated by agent authority ("clearance"), not by sync/async.** Only **"management" agents (Engineering Lead)** may use `run-build`/`ship-*`, and only with operator YES. **"Employee" agents (Code Reviewer, future delegates) structurally cannot** access them.
- Enforced via an `authority: "management" | "employee"` field on `AgentRegistration` driving tool exposure + the approval gate.

## init.md Phase 4 stories mapping

- **User sessions / agent threads** → Mastra memory threads (per-job isolation); no bespoke session system.
- **Context references** → typed `input` on `JobRecord`.
- **Workflow runs / job queue / structured outputs / full traceability** → Mastra background tasks + LibSQL + structuredOutput + observability substrate.
- **Model selection** → Phase 3 approach retained (tiers named in plan; concrete models from `config`/`.env`; per-job/per-agent `model?`); no secrets in tracked files.

## Delivery slices (ordered)

0. **Chore:** `framework-first` rule + `CONTEXT.md` definitions (Issue/WorkItem/Job).
1. **Observability substrate** (foundational, first).
2. **Job system** (`jobRegistry`/`JobRecord` projection + Mastra background tasks; `jobs`/`job #N`).
3. **Agentic delegation** (EL supervisor → Code Reviewer; auto-delegate on green; `review.missing`; clearance-gated tools).
4. **North-star verification** (CI machinery test w/ controlled model + local-only real-model delegation eval).

# Open questions resolved

- North-star framing → delegation via Code Reviewer (yes).
- Job vs WorkItem vs Issue → distinct nouns, documented; keep all three.
- Job store → SQL (LibSQL), but as a thin projection over Mastra runs, not a hand-rolled execution DB.
- Sync vs async → async, via Mastra background tasks (not a custom worker).
- Worker placement/concurrency/recovery → handled by Mastra's evented engine; no custom loop.
- Build vs reuse → reuse Mastra; record the framework-first rule.
- Notification across daemon/client → daemon forwards (option A).
- Observability bar → foundational, full-fidelity-capable + dial + redaction + queryable + eval-ready.
- Storage privacy → gitignored `.mastra/` + `.logs/`; never committed.
- Trigger / authority of review → agentic auto-delegate on green; advisory; tested as agentic, not via a forcing guardrail.
- Guardrail → non-correcting `review.missing` detection (one-off, not generalized).
- Structured I/O → generic envelope + per-kind zod payload via Mastra structuredOutput.
- Dangerous tools → clearance-gated to "management" (EL).

# Out of scope (→ Phase 4b / later)

- Necessity Reviewer (Ponytail) — second delegate / second job kind to prove generality.
- Multi-route gateway / direct operator→agent chat.
- Human-in-the-loop "employee raises a question to the operator" + multi-channel; the operator's own upgraded delegation system.
- Generalized "expected-outputs checklist / invariant tracker" (investigate Mastra task-completion scorers first).
- Broader scorer/eval library + cron health-check / self-healing debugger agent.
- Hard (blocking) review gating; cross-process pubsub (`UnixSocketPubSub`/Redis).
