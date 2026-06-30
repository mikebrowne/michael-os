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
A **probabilistic** unit of work — an English SOP (prompt) that packages judgment and may call tools, workflows, or other skills. Both its *dispatch* and its *body* are probabilistic. Skills are the home for irreducible judgment and the reviewable, English contract for behavior. As of Phase 6 a skill is a first-class object: a `SKILL.md` **bundle** ([Agent Skills spec](https://agentskills.io)) discovered, validated, scoped, permissioned, and loaded on demand via the **`skillRegistry`** wrapper over Mastra Agent Skills. Its deterministic muscle comes from **promoted Tools/Workflows built by the Engineering Department**, never code embedded in the skill.
_Avoid_: "prompt" (a skill is a packaged, reusable prompt + resources)

**Skill bundle**:
A skill's directory — `skills/<name>/SKILL.md` (YAML frontmatter + markdown SOP body) plus optional `references/`, `examples/`, and `evals/` subfolders. Reference material is disclosed **on demand** (progressive), never crammed into the index. A bundle's `scripts/` folder (if present) is **not executed** — deterministic muscle lives in promoted Tools.
_Avoid_: "skill file" (the bundle is the directory, not just `SKILL.md`)

**Skill index**:
The always-present list of every discovered skill's `name` + `description`, injected into an agent (format `markdown`) so the model knows what exists; full bodies + references load **on demand** via Mastra's `skill` / `skill_search` / `skill_read` tools. Built by `skillRegistry` over `workspace.skills`.
_Avoid_: "catalog" (loosely); never confuse the lightweight index with the loaded body.

**Progressive loading / activation**:
Exposing only the **skill index** by default and loading a skill's full body when the model calls the `skill` tool (**activation**). Replaces the pre-Phase-6 eager concat of all bodies into the prompt. Emits `skill.activated` telemetry.
_Avoid_: "eager loading", "preloading" (the whole point is on-demand)

**Skill scope**:
A skill's declared audience — `shared` (all agents, via `workspace.skills`) or `[agent-id, …]` (specific agents, via per-agent `Agent.skills`). Declared in frontmatter `metadata` and the **single source of truth**, projected onto Mastra by `skillRegistry`; `agentRegistry.ts` is a derived, validated view.
_Avoid_: "visibility", "access" (use "scope"; permission is the separate `allowed-tools` check)

**Skill permission (authority rule)**:
A skill declares `allowed-tools` / `allowed-workflows`; it may only be injected into an agent whose **authority** covers every tool in `allowed-tools`. A skill touching a `management`-only dangerous tool can never be injected into an `employee` agent — enforced at validation **and** injection. See ADR 0010.
_Avoid_: "skill role" (authority is what it may invoke, scope is who sees it)

**Skill Engineer**:
The **employee** agent (`skill-engineer`) that owns the skill lifecycle — create / edit / validate / EDD-test / deprecate / archive — under a **lighter gate** (validate + permission-check + commit), bypassing the full QA pipeline that *code* requires. It cannot build new deterministic tools itself; it files a `request-tool-build` Issue handoff to the **Engineering Lead** (management), who builds them through the promotion loop. Authoring skills (`write-skill`, `skill-eval-design`) are scoped only to it.
_Avoid_: "Skill Author" (reserved for the *autonomous* Phase 7 authoring agent), "Skill Steward"

**`skillRegistry` / `SkillRegistration`**:
The thin **anti-corruption wrapper** over Mastra Agent Skills (same pattern as `jobRegistry`/`JobRecord`, `promotionRegistry`/`PromotionRecord`): discovers `skills/**/SKILL.md`, validates frontmatter, reads `scope`/`allowed-tools`, and **projects** each skill onto Mastra's workspace/agent skills. Keeps framework churn a localized edit.
_Avoid_: bare "registry"/"record" (domain-qualify per naming conventions)

**Skill eval / EDD**:
Eval-driven development of a skill: its `evals/` cases (`{ input, expected behavior }`) scored by **Mastra scorers** via `eval-skill` / `npm run eval:skills` (local-only, real model). Write the eval first, watch it fail, then write the SOP until it passes — the red/green ratchet applied to judgment.
_Avoid_: "skill unit test" (skills are judgment; their tests are evals)

**Test mode / mock**:
A `testMode` flag propagated through Mastra's `requestContext` during skill evals. When on, any **side-effecting** tool (external write, message-send) returns a **declared mock/fixture** instead of performing the side effect, and marks telemetry `mocked: true`. The mock belongs to the **tool** (deterministic, reviewed), never invented by the skill/LLM. Full enforcement (every side-effecting tool ships a mock) lands in Phase 7.
_Avoid_: "dry run" (loosely), "stub" (the mock is a declared part of the tool)

**Workflow**:
A **deterministic ordering** of steps (tools and/or skills) — fixed orchestration. The sequence is known in advance; individual steps may still be probabilistic, but the ordering is not.
_Avoid_: "pipeline" (loosely), "skill" (a skill's orchestration is probabilistic)

**Sub-agent (delegate)**:
A full agent invoked by another agent as if it were a callable tool. Mastra exposes each configured sub-agent to the parent's model, runs it with its own instructions/model/memory, and returns a structured result. Delegation = treating a probabilistic composite (an agent) as a callable unit. The Code Reviewer is the Engineering Lead's first sub-agent.
_Avoid_: "child process", "worker" (those are execution mechanics, not the delegation concept)

**QA Engineer**:
The **employee** sub-agent (Phase 5 upgrade of the Code Reviewer) that runs the **verification workflow** over a staged change and returns one composite verdict. A *role* that accretes QA skills over time; its first gates are CI, code review, security review, and permission review. It may **assess** but structurally **cannot** stage, promote, roll back, or restart (only management — the Engineering Lead — can, with operator approval).
_Avoid_: "reviewer" (the QA Engineer owns more than review), "tester" (it orchestrates judgment + deterministic checks)

**Engagement Manager**:
The coordinator agent (Phase 4b) that is the **conversational front door** for engineering work: it takes the operator's request, runs **build-vs-reuse triage** (does something already exist?), and **routes** to the right specialist (Engineering Lead, Skill Engineer, …). The professional-agency rename of the old **"Ponytail" / Necessity Reviewer**. It is the **engineering-scoped** precursor to the org-wide **Chief of Staff** (Phase 8): the Engagement Manager does intake + simple routing + reuse triage; the Chief of Staff does intelligent, org-wide context routing and delegation summaries.
_Avoid_: "Ponytail", "router" (loosely), "Chief of Staff" (that is the broader Phase 8 role); never collapse the two.

**Codebase comprehension (Cursor read-only mode)**:
Using the **Cursor SDK harness as a codebase *reasoning* engine** — mapping structure / "what connects to what" and **discovering whether something is already built** — rather than only writing code. Exposed as a **read-only mode** behind the `CodingExecutor` seam: no writes (enforced by a disposable worktree, not just the prompt), **employee-safe** so many agents may hold it (EL planning, Debugger, Skill Engineer, the Engagement Manager's reuse triage). Output is judgment and must **cite files/symbols** the harness then **deterministically verifies**. Reserve it for judgment-heavy multi-hop questions; use `Grep`/registries for cheap lookups (the determinism ratchet). Contrast **implementation mode** — the existing `run-build` that writes code and stays **management-gated**. See ADR 0012.
_Avoid_: "Cursor = the SWE" (it is a shared capability with two modes), "codebase RAG" (we reuse Cursor's engine, not hand-roll retrieval)

**Steerable build / plan-and-slice**:
The Phase 6.5 build model: the executor runs as a **durable Cursor session** (`Agent.create` / `agent.send` / `Agent.resume`) instead of one-shot `Agent.prompt`, so a build can be **streamed, interrupted/redirected, inspected, and resumed after a restart**. The SDK exposes a **native conversation mode** (`mode: "agent" | "plan"`, settable per `send` via `SendOptions.mode`), so we use `mode: "plan"` for the plan turn and `mode: "agent"` for slice execution within one session. The **Engineering Lead owns the plan/checklist** and dispatches **one bounded slice per `send`**, verifying each before advancing — because judgment/authority/telemetry/gates belong in the EL, not because the SDK lacks a plan mode. The Software Engineer stays a dumb, bounded executor. See ADR 0011.
_Avoid_: "background queue" (steerable ≠ fire-and-forget); do not claim the SDK lacks plan mode (it exposes `AgentModeOption`)

**Staging / staged change**:
A green build pushed as a `feature/<slug>-<runId>` branch with an open **GitHub pull request**; the PR diff is the reviewable **staged diff**. Staging never touches `main`. It is the input to verification and the thing a **Promotion** later merges.
_Avoid_: "deploy", "release" (those are later/other concepts)

**Gate**:
A **blocking-by-default, operator-overridable** pass/fail check on a staged change — CI, code review, security review, or permission review. All gates green (or each failing gate explicitly overridden) is required to promote; every override is logged in the promotion ledger and telemetry.
_Avoid_: "check" (loosely), "test" (a gate may wrap tests but is the promotion control)

**Promotion**:
Merging a **verified** staged change (all gates green or overridden) to `main` after operator approval. The single operator decision point at the end of the engineering loop. Distinct from "ship" (Phase 2 vocabulary) and from "deploy".
_Avoid_: "ship" (reserved for the older direct path), "deploy", "release"

**PromotionRecord / promotionRegistry**:
The **ledger** of promotions — a thin projection over git (same pattern as `jobRegistry`/`JobRecord`) recording the promotion **commit SHA**, the linked Issue/WorkItem and `build-verification` Job, and which gates passed or were overridden. Enables one-command **Rollback** and an auditable history.
_Avoid_: bare "registry"/"record" (domain-qualify per naming conventions)

**Rollback**:
Undoing a promotion via **`git revert`** of its promotion commit (forward-only history; **never** a force-push or hard reset). Surfaced as `rollback #N`; a dangerous, management-only action requiring operator approval.
_Avoid_: "reset", "revert the branch" (rollback is a forward revert recorded in the ledger)

**Remediation loop**:
What happens on a **red** verdict or operator **NO**: the change is neither promoted nor discarded — the QA Engineer's findings go back to the **Engineering Lead**, which light-triages (security/permission → surface to operator; spec gap → re-spec; code-level → fix) and runs a **bounded** fix → re-verify loop (re-build with fresh context + findings, **cap of 3** attempts, configurable). At the cap it hard-stops, escalates, and the WorkItem moves to **`blocked`**. The staged PR stays open as a **draft** throughout. A NO routes to **fix / re-spec / park / abandon**.
_Avoid_: "retry loop" (it is triaged + bounded, not blind retry)

**WorkItem stages (Phase 5 additions)**:
**`staged`** (build green, PR open, verification running), **`blocked`** (remediation cap hit / needs an operator decision), and **`parked`** (set aside but recoverable — branch kept, PR kept open as a draft with a `parked` label, issue returned to the **Backlog** column, resumable via `resume #N`). `parked` ≠ `abandoned`: parked means "will revisit," abandoned means "won't do."
_Avoid_: conflating `parked` (resumable) with `abandoned` (terminal)

**Safe self-extension (Phase 7)**:
The system's ability to **build new pieces of itself** — skills, tools, workflows, even agents — under
autonomy **posture B ("notices and proposes")**: it may spot a need or be asked, **propose** the work
as a reviewable artifact, **draft** it (with its own passing test/eval), and run the existing safety
rails, but **activation is always an explicit, logged operator decision** and everything is reversible.
The emphasis is **safely**: autonomous *drafting + proposal + safe activation*, not unattended
self-modification (that is Phase 14 trust).
_Avoid_: "self-modifying" (loosely), implying unattended activation; posture C is out of scope.

**Authoring-policy skill**:
The **editable markdown skill** that holds the judgment of *when/whether/how to extend the system* — and
which **form** a need should take (**skill vs tool vs workflow vs new agent**). Deliberately a skill
(probabilistic judgment, rewritable as the operator's philosophy evolves), not hard-coded logic; the
deterministic muscle (scaffold / validate / register / test) stays in tools. Designed to be shareable
with the Phase 4b Engagement Manager's build-vs-reuse triage.
_Avoid_: "authoring rules engine" (it is judgment in markdown, not code).

**Skill Author / Tool Author / Workflow Author**:
The **autonomous authoring capabilities** (Phase 7), each a judgment skill on top of deterministic tools
(+ an optional workflow), handed to an **existing** agent rather than a new hire: **Skill Author** = the
**Skill Engineer** gaining an autonomous notice→propose→draft mode (lighter gate); **Tool Author** and
**Workflow Author** = capabilities on the **Engineering Lead** (building/promoting code is already its
job and authority), riding the **full code pipeline**. The Tool Author is the determinism ratchet made
literal — it **hardens a hot skill into a promoted tool** — and it enforces the **mock contract** (#40).
_Avoid_: "Skill Author = a new agent" (it is the Skill Engineer with initiative); "Author" for the
operator-driven Skill Engineer (that is Phase 6).

**Proposal gate / pending-proposals queue**:
The "should we even do this?" checkpoint **before any code**: the system drafts a **backlog GitHub
Issue** (user story + technical *and* non-technical detail) for operator go-ahead, reusing the grill →
PRD → `github-create-issue` flow. The **backlog itself is the visible pending-proposals queue** — no
separate gadget. Under low trust this is the *first* of two operator checkpoints (the second is
activation).
_Avoid_: "proposal inbox" (it is the GitHub backlog), "auto-build" (the gate precedes building).

**Safe activation**:
Bringing a freshly-authored artifact **live** only through the safety path that fits it — the Phase 6
**lighter gate** (skills), the Phase 5 **full pipeline** (tools/workflows), or a **new explicit
activation step + onboarding smoke-test** (agents) — with one rule on top: **a logged operator
"activate" yes**, and a required **passing test/eval** shipped with the artifact, and full reversibility
(git revert / set to draft / de-register).
_Avoid_: "deploy"/"release" (those are other concepts); "activate" without the logged operator yes.

**Approval seam / trust dial**:
The **single checkpoint function** every "ask the operator" moment routes through — hardwired today to
"always ask you" (reusing the Phase 5 approval-audit), but **structured so a future trust policy (Phase
14) can answer 'auto-approve when conditions hold'** for low-risk categories **without re-plumbing**.
Phase 7 builds only the **seam** (low-trust now, designed to loosen); the full approval **policy/trust
engine** is Phase 14.
_Avoid_: "policy engine" for the Phase 7 seam (the engine is Phase 14); "permanent gate" (it is a dial).

**Agent bundle**:
An agent's directory — `agents/<id>/agent.(yaml|md)` config (the "job description": role, authority,
model, tools, skills, `directChat`, `standalone`) plus the agent's own workspace folder (agent-scoped
skills / examples / evals / memory config) — mirroring the **skill bundle**. The **committed bundle is
the single source of truth** (public-safe, reviewable, git-reversible); `agentRegistry` becomes a
**derived, validated view** and **no `.ts` edits are needed to add an agent**. The runtime loader
**reuses Mastra** (`addAgent` + Stored-Agents dependency resolution); the gitignored `.mastra/` store is
a throwaway cache. See ADR 0014.
_Avoid_: "agent file" (the bundle is the directory); "Mastra Stored Agent as the truth" (that is a cache).

**Hiring / Onboarding**:
The **two steps** of standing up a new agent (Phase 7). **Hiring** = the judgment — should we add this
role, and what is its job description (the bundle config) — ending in the operator go-ahead (the
proposal gate); the hiring skill **may grill the operator** (reuse `grill-me-with-docs`), auto-answerable
later via the trust dial. **Onboarding** = wiring its starter skills/memory/registration and running an
**onboarding smoke-test it must pass before activation** (a probation beat). In Phase 7 both are
**skills on the Engineering Lead** (a dedicated "HR" agent is a later, reversible upgrade).
_Avoid_: collapsing hiring (decide + job description) and onboarding (wire + probation) into one step.

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
