# Phase 6.5: Steerable Engineering Loop (north star)

The build engine already runs headless via the **Cursor SDK** in isolated worktrees, and Phase 6 made
**judgment** (skills) first-class. What remains between today and **100% engineering off the IDE** is
not the *write* step — it is everything around it: the operator still opens the editor to **steer** a
drifting build, **see** what changed, **diagnose** a failure, and **reason** about how a change fits.
Phase 6.5 closes that gap.

## North star user story

> As the operator, I run the engineering loop entirely from the gateway. The **Engineering Lead**
> shows me a **plan/checklist** before any code is written, then dispatches **one bounded slice at a
> time** to the Software Engineer (Cursor). I watch the build **stream**, and if it drifts I
> **interrupt and redirect** it. When something fails, I ask the Lead to **read the failing file,
> re-run a single test, or show the diff** — without leaving the chat. Before building, the Lead can
> **map how a change connects** and **check whether it already exists**. If the gateway restarts
> mid-build, it **reattaches**. I only open the IDE when I am developing the harness itself.

## Core move: one-shot → durable Cursor session

Today `runAgentBuild` uses **`Agent.prompt`** (one-shot, fire-and-wait). The single architectural
change is migrating the `CodingExecutor` to a **durable session**:

| SDK call | Role in the loop |
|---|---|
| `Agent.create(...)` | Open a durable, multi-turn build session |
| `agent.send(...)` | Dispatch one **slice** (or a **plan-only** turn); context persists across sends |
| `run.stream()` | Live build output in the gateway |
| `run.wait()` | Terminal result of each slice (`finished` / `error` / `cancelled`) |
| `run.cancel()` | **Interrupt / redirect** a drifting slice (guard with `run.supports`) |
| `Agent.resume(agentId)` | Reattach to an in-flight build after a gateway restart |

This one change unlocks plan-mode, slice execution, streaming, interrupt, and restart-survival
together. See [ADR 0011](./adr/0011-steerable-builds-plan-and-slice.md).

## Plan/agent mode — native in the SDK; the EL owns the checklist

The Cursor **SDK exposes a native conversation mode**: `AgentModeOption = "agent" | "plan"`, settable
at `Agent.create` (`AgentOptions.mode`) **and per send** (`SendOptions.mode`). This is the same Plan
Mode shipped in the IDE and CLI (`Shift+Tab` / `/plan` / `--mode=plan`), available headlessly. Per the
[Cursor docs](https://cursor.com/docs/agent/plan-mode), in plan mode the agent researches the codebase,
**asks clarifying questions**, and produces a **reviewable markdown plan with a to-do list** before
writing any code.

### How it surfaces in the SDK (verified against `@cursor/sdk` v1.0.22)

The mechanism is concrete, not prose discipline:

- A plan-mode turn emits a **`createPlan` tool call** whose `args.plan` is the **markdown plan**
  (`CreatePlanToolCall` / `CreatePlanArgsSchema` in the SDK's tool-call types).
- Progress is tracked via **`updateTodos`** tool calls — a checklist of items with status
  `pending | inProgress | completed | cancelled` (`UpdateTodosToolCall` / `TodoItemSchema`).
- We capture both by tailing `run.stream()` for `SDKToolUseMessage` (`type: "tool_call"`,
  `name: "createPlan" | "updateTodos"`, `status: "completed"`), or by reading `run.conversation()`
  after `run.wait()`. The captured `plan` markdown **is** the Engineering Lead's checklist.

### The loop

Do **both steps on one durable `Agent` instance** so the plan turn's codebase research and the answers
to its clarifying questions carry into the build turn (the key advantage over one-shot `Agent.prompt`):

1. **Plan turn(s)** — `agent.send(planPrompt, { mode: "plan" })`. Plan mode may **ask clarifying
   questions** (returned as assistant text); the EL answers them from the PRD / Issue / comprehension
   context (instructing "make reasonable assumptions and state them" to minimize round-trips) or
   **escalates to the operator** when a question is genuinely blocking. Loop `send`s in `mode: "plan"`
   until a `createPlan` arrives. Persist the plan markdown to the WorkItem `stateDir` (and optionally
   mirror to `.cursor/plans/`). Belt-and-suspenders: prompt **"do not write any code"** (Cursor's own
   recommended planning prompt) and run in a **disposable worktree** so any stray write is discarded.
2. **Operator/EL approves** (and may edit) the checklist.
3. **Build turn(s)** — `agent.send(buildPrompt + approvedPlan, { mode: "agent" })` on the **same**
   agent, one bounded slice per `send`, each **verified** (tests / gates) before advancing. Tail
   `updateTodos` for live progress/telemetry.
4. **Drift** → `run.cancel()` + a corrective `send`. **Restart** → `Agent.resume(agentId)`.

The native mode is the *mechanism*; the **plan still lives in the Engineering Lead**. We keep the
EL-owned checklist + per-slice verification not because the SDK lacks plan mode (it does not), but
because that is where **judgment, authority, telemetry, and gates** belong — the SWE stays a **dumb,
bounded executor**. The hash-locked acceptance test remains the per-feature "done" gate; the checklist
sits above it as the per-slice plan.

## Leverage Cursor for reasoning, not only writing

Cursor's harness is a **codebase reasoning engine**, not just a code writer. Expose it in two
**authority-gated modes** behind the `CodingExecutor` seam:

| Mode | Side effects | Authority | Used by |
|---|---|---|---|
| **Comprehension** (read-only): map structure, find existing, plan integration | none | employee-safe → broadly available | EL planning, Debugger, Skill Engineer, Engagement Manager triage |
| **Implementation** (write): the current `run-build` | writes code | management-gated | EL dispatch only |

Discipline (from the determinism ratchet): reach for comprehension only for **judgment-heavy
multi-hop** questions; use `Grep`/`Glob`/the registries for cheap lookups. Comprehension output is
**judgment** — it must **cite files/symbols**, which the harness then **deterministically verifies**.
Read-only is enforced by the **environment** (disposable worktree, writes discarded), not the prompt.
See [ADR 0012](./adr/0012-cursor-comprehension-mode.md). This is the same framework-first instinct that
made Phase 6 reuse Mastra Agent Skills: do not hand-roll a codebase-RAG when Cursor already optimized
the engine.

## Scope (candidate slices)

1. **Durable executor** — migrate `CodingExecutor` to `Agent.create`/`send`/`resume`; keep the
   one-shot path behind a flag for reversibility.
2. **Plan-and-slice** — EL owns a checklist; dispatch one slice per `send`; verify between slices.
3. **Stream + interrupt** — `run.stream()` to the gateway; `run.cancel()` + corrective `send`.
4. **In-loop inspection** — tools to read a worktree file, re-run a single test, tail the build log.
5. **Comprehension mode** — read-only Cursor capability (Tool) + a "when to invoke" Skill; cite-and-verify.
6. **PR / CI ingestion** — pull PR review comments + CI failures back as loop inputs.
7. **Operator visibility** — a minimal status/diff surface (`Agent.list` / `Agent.getRun`).
8. **Session-scoped approval (minimal)** — pre-authorize a class of actions for the session.

## What "100% engineering ready" means (exit criteria)

- A well-specified feature runs **grill → plan → sliced build → verify → promote** entirely from the
  gateway, with the operator steering and observing — **no IDE**.
- A **drifting** build can be interrupted and redirected in-loop.
- A **failed** build can be diagnosed in-loop (read file / re-run test / view diff).
- The EL can **map integration** and **check reuse** before building.
- A gateway **restart** does not lose an in-flight build.
- The IDE is needed only for **developing the harness itself** (new tools/agents → Phase 7).

## Out of scope (later)

- The full approval **policy engine** (classes, audit) — Phase 7 "safe activation" / Phase 14 trust.
- A rich web dashboard beyond a minimal status surface.
- Autonomous authoring agents (Tool/Agent/Skill authors) — **Phase 7**.
- The **Engagement Manager** + multi-agent chat — **Phase 4b** (consumes comprehension mode for reuse triage).
- Roster expansion (Debugger / Security / Spec / Planning / Test) — **Phase 4c**.

## Relationship to other phases

- **Phase 6 (done)** — judgment is first-class (skills); this phase makes the *loop* steerable.
- **Phase 4b** — the Engagement Manager's reuse triage is a first consumer of comprehension mode.
- **Phase 4c** — the Debugger is the agent form of this phase's diagnosis surface.
- **Phase 7** — self-extension (authoring) comes *after* the loop is steerable and observable.
- **Phase 8** — the org-wide Chief of Staff generalizes the engineering-scoped Engagement Manager.
