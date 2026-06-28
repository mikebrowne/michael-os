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

## Example dialogue

> **Dev:** When the demo runs, does it read the operator's vault?
> **Michael:** No — the demo and tests only ever touch the *demo vault* in `examples/demo-vault/`. The real *vault* is private; the harness only reaches it when `VAULT_PATH` points outside the repo, and that path is never committed.
> **Dev:** And where do run logs go?
> **Michael:** Run logs are JSONL under `./.logs/`, which is gitignored. Nothing about a run reaches the public repo.
> **Dev:** When the Engineering Lead has the Code Reviewer look at a green build, what is that?
> **Michael:** That's a *Job* — a bounded, delegated, traced task under the feature's *WorkItem*. The feature's public identity is its *Issue*; its private lifecycle is the *WorkItem*; each delegation is a *Job*. The Reviewer is an *employee* (no dangerous-tool *authority*); the Lead is *management*. The Job's trace lands in the gitignored `.mastra/` store, redacted.
