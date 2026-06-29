# Steerable builds: the Engineering Lead owns the plan; the SWE executes bounded slices

Through Phase 6 the coding executor (`runAgentBuild` → `CursorExecutor`) used the Cursor SDK's
**one-shot `Agent.prompt`**: a single fire-and-wait call that writes code and returns. This is a
**black box** — the operator cannot watch it, steer it when it drifts, inspect intermediate state, or
recover it after a gateway restart, which is precisely why engineering work still pulls the operator
back into the IDE. The Cursor **SDK has no Plan Mode / Agent Mode toggle** (that is an IDE-only
construct), so we cannot ask the SDK for "plan first, then act." **Decision:** migrate the
`CodingExecutor` to a **durable Cursor session** (`Agent.create` → `agent.send` → `Agent.resume`) and
put the **plan at the harness level**. The **Engineering Lead owns a plan/checklist**: a first
**plan-only** `send` (read-only by environment — a disposable worktree whose writes are discarded)
produces a step plan + integration map; after approval the Lead dispatches **one bounded slice per
`agent.send`**, **verifying each slice** (tests/gates) before advancing, and **redirects** a drifting
slice with `run.cancel()` + a corrective `send`. The Software Engineer stays a **dumb, bounded
executor**; all judgment — planning, verification, re-planning — lives in the Engineering Lead, where
**authority, telemetry, and gates already are**. This single change unlocks **plan-mode, slice-by-slice
execution, streaming (`run.stream`), interrupt (`run.cancel`), and restart-survival (`Agent.resume`)**
at once. The hash-locked acceptance test remains the per-feature "done" gate; the checklist sits above
it as the per-slice plan. For reversibility the one-shot path is kept behind a flag so the durable
session can be rolled back without breaking the loop.

Considered alternatives: **keep one-shot `Agent.prompt`** — rejected; it is the root cause of the
black-box problem and forecloses steering, observation, and recovery. **Build a custom plan-mode layer
inside the SWE prompt** (ask the model to "plan, then implement" in one run) — rejected; it is not a
real gate (the model can ignore it), produces no harness-visible checklist, and duplicates judgment the
Engineering Lead should own. **Revive a background job queue for builds** — rejected here; Phase 4's
delegation-rework already chose *run-now-and-wait* for interactive work, and steerable ≠
fire-and-forget. **Put the plan in the Software Engineer instead of the Engineering Lead** — rejected;
it leaks judgment and authority into the executor and breaks the determinism ratchet (the SWE is a
leaf executor, the EL is the orchestrating composite). **Wait for an SDK plan-mode feature** — rejected
as speculative; the EL-owned plan gives the same behavior today with capability we control. The
trade-off is more orchestration logic in the Engineering Lead and more SDK surface in the executor
wrapper; we accept it because the wrapper stays a thin anti-corruption layer (localized to one seam),
and steerability is the specific capability that closes the gap to 100% engineering off the IDE.
