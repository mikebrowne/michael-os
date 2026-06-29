# Steerable builds: the Engineering Lead owns the plan; the SWE executes bounded slices

Through Phase 6 the coding executor (`runAgentBuild` → `CursorExecutor`) used the Cursor SDK's
**one-shot `Agent.prompt`**: a single fire-and-wait call that writes code and returns. This is a
**black box** — the operator cannot watch it, steer it when it drifts, inspect intermediate state, or
recover it after a gateway restart, which is precisely why engineering work still pulls the operator
back into the IDE. The Cursor **SDK exposes a native conversation mode** —
`AgentModeOption = "agent" | "plan"`, settable at `Agent.create` (`AgentOptions.mode`) **and per send**
(`SendOptions.mode`) — so "plan first, then act" is available headlessly (the IDE plan→act flow).
**Decision:** migrate the `CodingExecutor` to a **durable Cursor session** (`Agent.create` →
`agent.send` → `Agent.resume`) and use **native plan mode for the plan turn and agent mode for slice
execution**, while keeping the **plan/checklist owned by the Engineering Lead**. A first **plan-mode**
`send` (`{ mode: "plan" }`) produces a step plan + integration map; after approval the Lead dispatches
**one bounded slice per `send`** (`{ mode: "agent" }`), **verifying each slice** (tests/gates) before
advancing, and **redirects** a drifting slice with `run.cancel()` + a corrective `send`. The Software
Engineer stays a **dumb, bounded executor**; all judgment — planning, verification, re-planning — lives
in the Engineering Lead, where **authority, telemetry, and gates already are**. Crucially, the EL owns
the plan **not because the SDK lacks plan mode (it does not) but because that is the correct home for
judgment and authority**; native plan mode is the *mechanism*, the EL-owned checklist is the *control*.
This single change unlocks **plan/agent mode, slice-by-slice execution, streaming (`run.stream`),
interrupt (`run.cancel`), and restart-survival (`Agent.resume`)** at once. The hash-locked acceptance
test remains the per-feature "done" gate; the checklist sits above it as the per-slice plan. We still
run planning/comprehension in a **disposable worktree** as belt-and-suspenders (verify plan mode's
exact file-write behavior in the installed SDK version at build time). For reversibility the one-shot
path is kept behind a flag so the durable session can be rolled back without breaking the loop.

Considered alternatives: **keep one-shot `Agent.prompt`** — rejected; it is the root cause of the
black-box problem and forecloses steering, observation, and recovery. **Use native plan mode but let
the Software Engineer own the plan** (skip the EL checklist) — rejected; it leaks judgment and
authority into the executor and breaks the determinism ratchet (the SWE is a leaf executor, the EL is
the orchestrating composite), and it loses the harness-visible, verifiable, gated checklist. **Fake
plan mode via prompt discipline** (a "plan, do not edit" prompt in `mode: "agent"`) — rejected now that
a **native `mode: "plan"`** exists; the prompt-only version is not a real gate (the model can ignore
it). It survives only as a fallback if native plan mode's behavior proves unsuitable in the installed
version. **Revive a background job queue for builds** — rejected here; Phase 4's delegation-rework
already chose *run-now-and-wait* for interactive work, and steerable ≠ fire-and-forget. The trade-off
is more orchestration logic in the Engineering Lead and more SDK surface in the executor wrapper; we
accept it because the wrapper stays a thin anti-corruption layer (localized to one seam), and
steerability is the specific capability that closes the gap to 100% engineering off the IDE.

Mechanism (verified against `@cursor/sdk` v1.0.22 and the Cursor Plan Mode docs): a plan-mode turn
researches the codebase, **asks clarifying questions** (returned as assistant text — the EL answers
from PRD/Issue context or escalates to the operator), and emits a **`createPlan` tool call** whose
`args.plan` is the **markdown plan**; progress during build is reported via **`updateTodos`** tool
calls (`pending | inProgress | completed | cancelled`). The harness captures these by tailing
`run.stream()` for `SDKToolUseMessage` (`name: "createPlan" | "updateTodos"`) or via
`run.conversation()`. Both the plan turn and the build turns run on the **same durable `Agent`** so the
plan-turn research and clarifying answers carry into execution. Per Cursor's guidance we also prompt
**"do not write any code"** on the plan turn and keep the disposable worktree as the hard read-only
guarantee.

> **Correction (2026-06-28):** an earlier draft of this ADR claimed the SDK had *no* Plan/Agent mode
> toggle. That was wrong — `@cursor/sdk` v1.0.22 exports `AgentModeOption = "agent" | "plan"` on both
> `AgentOptions.mode` and `SendOptions.mode`, backed by the `createPlan` / `updateTodos` tool calls.
> The decision (durable session + EL-owned plan-and-slice) stands; the *rationale* is corrected: native
> mode is the mechanism, the EL-owned checklist is the control. Verify plan mode's exact file-write
> semantics in the installed version during slice 1.

> **Plan-mode write behavior (verified slice 1, `@cursor/sdk` v1.0.22):** native `mode: "plan"` is
> designed to research and emit a `createPlan` tool call (markdown plan + todos) without implementing.
> The SDK still exposes write/edit tool types in the type system, so we **do not** treat plan mode
> alone as a hard side-effect gate. Belt-and-suspenders: prompt **"do not write any code"** on plan
> turns and run plan/comprehension in a **disposable worktree** whose writes are discarded — that
> environment boundary is the hard read-only guarantee. Implementation turns use `mode: "agent"` on
> the same durable `Agent` after plan approval.
