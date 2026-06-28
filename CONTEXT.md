# MichaelOS

A local-first, public-safe personal AI harness. The public repository holds the runtime, agents, tools, and engineering rails; the operator's private knowledge and runtime state stay outside the repo.

## Language

**MichaelOS** (a.k.a. **the harness**):
The local-first runtime and the organization of agents/tools/workflows it hosts. Built in public; runs privately on the operator's machine.
_Avoid_: "the app", "the bot", "the system"

**Vault**:
The operator's private knowledge store (a real Obsidian vault) living entirely outside the tracked repo and referenced only by a `VAULT_PATH` configured in `.env`. Never committed.
_Avoid_: "notes folder", "knowledge base" (when meaning the private one)

**Demo vault**:
A small, fully fake, public-safe sample vault committed at `examples/demo-vault/` and used by tests and local demos. Contains no real or sensitive data.
_Avoid_: "test vault", "sample data" (use "demo vault" specifically)

**Operator**:
The single human who owns and runs the harness on their own hardware (the Mac mini). There is one operator.
_Avoid_: "user", "customer", "account"

**Run log**:
A structured (JSONL) record of a runtime execution written to the gitignored `./.logs/` directory. Local-only, never committed.
_Avoid_: "trace" (reserved for richer Mastra telemetry), "audit log"

**Trace**:
Richer Mastra AI-tracing telemetry (correlated spans for agent/tool/delegation/model calls) persisted to the gitignored `.mastra/` LibSQL store and correlated with run logs by shared IDs. Local-only, never committed; secrets/PII are redacted before persistence.
_Avoid_: "log" (use "run log" for JSONL), "audit trail"

**Issue**:
The **public** identity and bookmark of a feature, tracked as a GitHub Issue (the system of record). One per feature; linked 1:1 to a WorkItem. Holds title, PRD body, and board state — not runtime mechanics.
_Avoid_: "ticket", "card", "task" (a Job is the task)

**WorkItem**:
The **private** lifecycle state of a feature, stored in the gitignored runtime state (`stateDir`). One per feature (1:1 with its Issue), it is the state machine for the whole loop (grill → prd → tests → build → ship → done) and points to grill notes, PRD, acceptance test, build manifest, and hashes. Deliberately separate from the Issue because of the public-safe boundary.
_Avoid_: "task", "ticket", "project" (when meaning a single feature's state)

**Job**:
One **bounded, delegated, traced task** performed under a WorkItem (many per WorkItem). A Job records who it was delegated to (`delegatedTo`), its input/context references, its structured output, and its trace (`mastraRunId`/`traceId`). The Code Reviewer's review of a green build is a Job. Persisted via `jobRegistry` / `JobRecord` as a projection over Mastra runs in the gitignored LibSQL store.
_Avoid_: "call", "step", "task" (reserve "task" for plain English; a Job is the unit of delegation)

**Authority / clearance**:
An agent's permission level on the `AgentRegistration` — `management` (e.g. the Engineering Lead) may use dangerous tools (with operator approval); `employee` (e.g. the Code Reviewer and future delegates) structurally cannot.
_Avoid_: "role" (role = who the agent is; authority = what it is allowed to do)

**Tool**:
A **deterministic** unit of work — a script or CLI call with a fixed body — exposed to an agent. Its *body* always does the same thing for the same input; its *dispatch* (whether and with what arguments it is called) is decided probabilistically by the agent. Use tools for repeatable, auditable operations.
_Avoid_: "action", "function" (when meaning the registered unit), "skill" (a skill is judgment, not fixed logic)

**Skill**:
A **probabilistic** unit of work — an English SOP (prompt) that packages judgment and may call tools, workflows, or other skills. Both its *dispatch* and its *body* are probabilistic. Skills are the home for irreducible judgment and the reviewable, English contract for behavior.
_Avoid_: "prompt" (a skill is a packaged, reusable prompt + resources)

**Workflow**:
A **deterministic ordering** of steps (tools and/or skills) — fixed orchestration. The sequence is known in advance; individual steps may still be probabilistic, but the ordering is not.
_Avoid_: "pipeline" (loosely), "skill" (a skill's orchestration is probabilistic)

**Sub-agent (delegate)**:
A full agent invoked by another agent as if it were a callable tool. Mastra exposes each configured sub-agent to the parent's model, runs it with its own instructions/model/memory, and returns a structured result. Delegation = treating a probabilistic composite (an agent) as a callable unit. The Code Reviewer is the Engineering Lead's first sub-agent.
_Avoid_: "child process", "worker" (those are execution mechanics, not the delegation concept)

## Kinds of work (the determinism ratchet)

Two axes describe every unit of work:

- **Dispatch** — how it is chosen and parameterized (who decides to run it, with what inputs).
- **Body** — how it executes once chosen.

Each can be **deterministic** (decision rule known in advance — codify it) or **probabilistic / judgment** (decision discovered at runtime — let a model handle it). This is the operational meaning of the house rule *code for deterministic work; LLMs for judgment*: the real axis is whether the decision rule is known ahead of time.

The entry points fall on a leaf/composite × deterministic/judgment grid:

| | Deterministic (fixed logic) | Probabilistic (judgment) |
|---|---|---|
| **Leaf** (does one thing) | **Tool** | a raw model call |
| **Composite** (orchestrates) | **Workflow** | **Skill** / the agent itself |

A **tool** has a deterministic body but a probabilistic dispatch (the agent decides to call it). A **sub-agent** is a probabilistic composite invoked as if it were a leaf tool — that is exactly what delegation is.

### The ratchet (how a capability matures)

Probabilistic is where you are *before* you understand a problem; deterministic is where you are *after*. Capabilities mature along a one-way ratchet:

1. **Observe** a happy path (a human, or the agent, does it once).
2. **Capture** it as a skill — an English SOP, cheap to write and review.
3. **Harden** as edge cases appear: each breakage either adds a guardrail to the skill or is *extracted* into a deterministic tool/workflow now that it is understood. Each fix is pinned by a test (the same red/green discipline used for code).
4. The skill grows **thinner** — an orchestrator wrapping fatter deterministic pieces — until only the irreducible judgment core remains.

The goal is not to eliminate probabilistic work but to **shrink it to its true minimum**. Deterministic is always cheaper, faster, more auditable, and safer; the boundary moves outward as understanding grows *and* as models get cheaper, but for an org facing a changing world the judgment core never reaches zero. Over-codifying the open-ended part makes the system brittle to novel inputs — the skill is the correct permanent home for genuine judgment.

### Consequence for delegation

Delegation is itself a skill (the judgment of *when / what / to whom*) sitting on a deterministic substrate (job tracking, timeouts, observability). The *mechanism* of "one agent calls another" is provided by **Mastra sub-agents** and should be reused, not hand-rolled (framework-first). What MichaelOS owns is the domain layer on top: **Job** as a noun, correlated **observability**, and **authority** gating.

## Example dialogue

> **Dev:** When the demo runs, does it read the operator's vault?
> **Michael:** No — the demo and tests only ever touch the *demo vault* in `examples/demo-vault/`. The real *vault* is private; the harness only reaches it when `VAULT_PATH` points outside the repo, and that path is never committed.
> **Dev:** And where do run logs go?
> **Michael:** Run logs are JSONL under `./.logs/`, which is gitignored. Nothing about a run reaches the public repo.
> **Dev:** When the Engineering Lead has the Code Reviewer look at a green build, what is that?
> **Michael:** That's a *Job* — a bounded, delegated, traced task under the feature's *WorkItem*. The feature's public identity is its *Issue*; its private lifecycle is the *WorkItem*; each delegation is a *Job*. The Reviewer is an *employee* (no dangerous-tool *authority*); the Lead is *management*. The Job's trace lands in the gitignored `.mastra/` store, redacted.
> **Dev:** Should the review be a tool or a skill?
> **Michael:** The *act* of reviewing is a *skill* (judgment), run by the Reviewer *sub-agent*. The *deciding to delegate* is also judgment. What's deterministic — and so belongs in *tools/workflows* — is the substrate around it: tracking the *Job*, timeouts, and *observability*. We start probabilistic, then ratchet the understood parts into deterministic code as edge cases appear.
