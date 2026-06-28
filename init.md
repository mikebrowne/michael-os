# MichaelOS Build Plan

## Always-On Build Rules

These are not phases. They apply from day one through Cursor rules, AGENTS.md, repo rules, CI rules, and future agent operating principles.

1. **Public-safe by default**

   * The repo must be safe to build in public.
   * No private vault data, API keys, logs, traces, webhook URLs, journal entries, personal data, or sensitive config should enter the public repo.

2. **GitHub is the build system of record**

   * Buildable work becomes GitHub Issues, specs, PRs, commits, project items, CI checks, or reviewable diffs.

3. **Private data stays outside the public repo**

   * Obsidian vaults, private logs, traces, local config, and runtime state remain outside the tracked repository.

4. **Secrets are referenced, never exposed**

   * Use `.env`.
   * Commit `.env.example`.
   * Never expose secret values.

5. **Agents propose changes through reviewable artifacts**

   * Specs
   * Issues
   * Diffs
   * PRs
   * Promotion requests

6. **Dangerous capabilities require approval**

   * Shell execution
   * Dependency installation
   * File deletion
   * Permission expansion
   * External writes
   * Sending messages
   * Harness restarts
   * Secrets access

7. **Observability expands with capability**

   * Every new feature should add telemetry.

8. **Build thin vertical slices**

   * Build complete loops.
   * Then make each layer deeper.

9. **Code for deterministic work**

   * LLMs for judgment.
   * Code for repeatable operations.

10. **Everything should be reversible**

    * Git
    * Tests
    * CI
    * Rollback
    * Promotion history

# Phase 0: Public Safe Repo and Project Tracking

## Goal

A public-safe repository with project tracking, CI, issue templates, and engineering guardrails.

### User Stories

* Public GitHub repository
* GitHub Projects
* GitHub Issues
* Issue templates
* `.env.example`
* Secret scanning
* Initial CI
* Cursor rules
* AGENTS.md

# Phase 1: Minimal Mastra Runtime

## Goal

A local Mastra runtime capable of hosting agents, tools, workflows, and observability.

### User Stories

* Minimal Mastra project
* Folder structure
* Local configuration
* Demo vault
* Local logging
* Mac mini runtime

# Phase 2: First Tiny Engineering Loop

## Goal

Prove one complete engineering loop.

### User Stories

* Engineering Lead agent
* Spec skill
* GitHub Issue tool
* File tools
* Test tool
* Logging
* First successful end-to-end build

# Phase 3: Seed Skills and Engineering Department

## Goal

Create a small but capable Engineering Department.

### User Stories

* Seed engineering skills
* Skill folder convention
* Ponytail feature necessity review
* Matt Pocock inspired skills
* Agent registry
* Spec Agent
* Planning Agent
* Implementation Agent
* Test Agent
* Reviewer Agent
* Debugger Agent
* Security Agent
* DevOps Agent

# Phase 4: Sessions, Delegation, and Job System

## Goal

Allow bounded delegation with full observability.

### User Stories

* User sessions
* Agent threads
* Delegation jobs
* Workflow runs
* Delegation tool
* Context references
* Job queue
* Structured outputs
* Model selection
* Full traceability

# Phase 5: Staging, Review, and Promotion

## Goal

Every generated change is staged, reviewed, validated, and promotable.

### User Stories

* Staged diffs
* Review workflow
* Security review
* CI integration
* Permission review
* Rollback
* Controlled restart flow

# Phase 6: Skill Platform

## Goal

Skills become first-class reusable system objects.

> **Grilled 2026-06-28 — framework-first pivot.** The installed Mastra (`@mastra/core@^1.46`) already
> ships the full **Agent Skills** system (spec format, validation, index, progressive loading, shared
> vs agent-specific scoping, versioning). Phase 6 **adopts Mastra Agent Skills behind a thin
> `skillRegistry` wrapper** and builds only the domain gaps: authority/permission gating,
> Job-correlated telemetry, the **Skill Engineer** agent, and skill **EDD**. See
> [docs/phase-6-skill-platform.md](./docs/phase-6-skill-platform.md),
> [ADR 0009](./docs/adr/0009-mastra-agent-skills-substrate.md),
> [ADR 0010](./docs/adr/0010-skill-permission-lifecycle.md).

### User Stories

* YAML skill format → Mastra `SKILL.md` + frontmatter (domain fields in `metadata`)
* Shared skills → `workspace.skills`
* Agent-specific skills → per-agent `Agent.skills` + frontmatter `scope`
* Skill index → `workspace.skills.list/search`, injected as `markdown`
* Progressive loading → Mastra `skill` / `skill_search` / `skill_read` tools (retire eager concat)
* Skill permissions → `allowed-tools` ⊆ agent authority (enforced at validation + injection)
* Script-backed skills → skills **invoke** Engineering-built, promoted Tools/Workflows (muscle is not embedded; `scripts/` not executed)
* Skill validation → `validateSkillMetadata` wrapper + scope/permission checks
* Skill telemetry → five Job-correlated `skill.*` run-log events
* **Skill Engineer** agent (employee) + lighter-gate lifecycle (skill changes bypass full QA)
* Skill **EDD** (`evals/` + Mastra scorers + `npm run eval:skills`) + tool `testMode`/mock

Deferred to Phase 7: autonomous authoring agents (Skill Author / Tool Author / Hiring),
"adapt from external skill", and automated enforcement that every side-effecting tool ships a mock.

# Phase 7: Authoring Agents

## Goal

The system can safely extend itself.

### User Stories

* Skill Author Agent
* Tool Author Agent
* Workflow Author Agent
* Hiring Agent
* Staged promotion
* Engineering review
* Safe activation

Note (from Phase 6 grill): the **Tool Author** must enforce the **tool test-mode/mock contract** — every tool with side effects (external writes, message-sending) must support a `testMode` flag (propagated via `requestContext`) that returns a declared mock instead of performing the side effect, ship that mock as part of the tool, and include a test. Phase 6 establishes the `testMode` channel + contract + a fixture; Phase 7 makes the enforcement automated (e.g. a CI/permission-scan check that side-effecting tools declare a mock). Captured here so it is not lost.

Note: I had a though about adding agents w/o needing to restart the gateway. What if an agent can just be a YAML like file and we have a set of code that just creates the agents based on the YAML? That way we aren't changing any .ts files. By doing this, it may be easier to have the system spin up its own agents.

Note: for the hiring agent, we probably want to have a hiring process (probably a hiring skill or onboarding skill or something) that outlines what needs to happen to hire or onboard a new agent (would hiring and onboarding be 2 different things? Maybe!)

# Phase 8: Chief of Staff

## Goal

A conversational router that coordinates the organization.

### User Stories

* Chief of Staff
* Agent directory
* Intelligent routing
* Context routing
* Engineering delegation
* Delegation summaries

# Phase 9: Second Brain / Wiki LLM

## Goal

Convert raw information into durable structured knowledge.

### User Stories

* Private Obsidian vault
* Raw inboxes
* Inbox triage
* Structured wiki
* Wiki updates
* Commitments
* Reminders
* Scheduled jobs
* GitHub Issues
* Skill ideas
* Tool ideas
* Workflow ideas
* Agent ideas
* Project notes
* Journal entries
* Public artifact ideas
* Safe Obsidian tools
* Source tracking
* Wiki metadata
* Structured RAG
* Privacy boundaries

# Phase 10: Scheduled Jobs and Operations

## Goal

A reliable local scheduling platform.

### User Stories

* Cron and launchd
* Job registry
* Temporary reminders
* Recurring workflows
* Tags
* Categories
* Folder organization
* Workflow schedules
* Logging
* Webhooks
* Secure webhook execution

# Phase 11: Project Finishing

## Goal

Turn unfinished work into leverage.

### User Stories

* Project Finisher department
* Finish/archive decisions
* Lessons learned
* Public memos
* README generation
* Reusable components

# Phase 12: Additional Departments

## Goal

Expand into broader life and business domains.

### User Stories

* Journal Coach
* Fitness Department
* Business Strategy
* Email integration
* Calendar integration
* Plaud integration
* WhatsApp integration
* Safe external actions

# Phase 13: Public Journal

## Goal

Build in public without losing the fun.

### User Stories

* Build logs
* Loom videos
* Livestreams
* Architecture notes
* Public artifacts
* Safety filters
* Optional content repurposing
* Loose polymath journal

# Phase 14: Self-Evolving Organization

## Goal

A trustworthy personal AI organization that compounds over time.

### User Stories

* Local-first AI organization
* Self-improving engineering
* Safe self-extension
* Durable leverage
* Better memory
* Better execution
* More finished projects
* Greater long-term compounding
