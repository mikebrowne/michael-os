# MichaelOS Foundation: Public-Safe Repo and Minimal Mastra Runtime

## Problem Statement

The operator wants to build MichaelOS — a local-first personal AI harness — in public, on a Mac mini, without ever leaking private data. Today the repository contains only a vision document (`init.md`). There is no git history, no public-safety scaffolding, no project-tracking conventions, and no runnable runtime. Starting to build features now would risk committing secrets or private Vault data, and would have no logging or CI to make the work observable and reversible.

## Solution

Establish a clean foundation in two thin slices. First, make the repository public-safe and trackable: git history, secret-safety rails, CI, issue and pull-request templates, operating rules for both humans and agents, and a clearly fake Demo vault. Second, stand up a minimal MichaelOS runtime on Mastra that runs locally, has a tidy folder structure for future agents/tools/workflows, reads private settings from outside the tracked repo, and emits basic Run logs. The result is a trustworthy base the operator can build real engineering loops on later — not the full agent organization.

## User Stories

1. As the operator, I want the repository under git with a public-safe structure, so that I can build in public from the first commit without leaking private data.
2. As the operator, I want a `.gitignore` that excludes `.env`, run logs, runtime state, local config, and any real Vault path, so that private artifacts can never be committed by accident.
3. As the operator, I want a committed `.env.example` with placeholders only, so that contributors know which settings exist without ever seeing real secret values.
4. As the operator, I want secrets referenced and never exposed, so that the public repo stays safe even as capabilities grow.
5. As the operator, I want a gitleaks secret-scan running in CI, so that an accidental secret commit is caught automatically.
6. As the operator, I want CI to lint, typecheck, build, and run unit tests with zero secrets, so that a fresh clone proves green without any private configuration.
7. As the operator, I want GitHub Issue templates for bugs, features, specs, and capability ideas, so that buildable work becomes structured, reviewable tracking items.
8. As the operator, I want a pull-request template, so that every change arrives as a reviewable artifact with consistent context.
9. As the operator, I want the steps to set up GitHub Projects documented, so that I can track the build without bespoke tooling.
10. As the operator, I want an `AGENTS.md` that encodes the always-on build rules and the list of dangerous capabilities requiring approval, so that any agent working in the repo inherits the operating principles.
11. As the operator, I want Cursor rules that encode public-safety, secret-handling, reversibility, and thin-vertical-slice guidance, so that agents editing the repo are steered toward safe defaults.
12. As the operator, I want a public, MIT-licensed repository named for the project, so that the work is clearly shareable.
13. As the operator, I want a minimal Mastra runtime that starts locally, so that I have a real place to host future agents, tools, and workflows.
14. As the operator, I want a clean folder structure for agents, tools, workflows, skills, schemas, scripts, tests, docs, and examples, so that future capabilities have an obvious home without restructuring later.
15. As the operator, I want private and local settings to load from `.env` and an untracked local config, so that the runtime is configurable without committing anything sensitive.
16. As the operator, I want a committed Demo vault of clearly fake notes, so that tests and demos run against safe data and never touch the real Vault.
17. As the operator, I want the runtime to find the real Vault only through `VAULT_PATH`, so that private knowledge stays entirely outside the tracked repo.
18. As the operator, I want basic Run logs written as JSONL to a gitignored directory, so that I can observe what the runtime did without exposing anything publicly.
19. As the operator, I want a deterministic demo workflow that runs without any LLM key, so that CI and a fresh machine can exercise the runtime offline.
20. As the operator, I want a separate local demo script that makes a real LLM call, so that I can prove a genuine model loop on my Mac mini using my own key.
21. As the operator, I want clear Mac mini local-development instructions, so that I can set up prerequisites, environment, and the demo from a clean machine.
22. As the operator, I want each change delivered as a small, isolated commit, so that every step is reviewable and reversible.
23. As the operator, I want observability to grow with the runtime from the start, so that logging is a habit rather than an afterthought.
24. As a future contributor, I want the dangerous-capabilities policy written down, so that I understand which actions require explicit approval even before runtime gating exists.
25. As the operator, I want the runtime to fail clearly when required settings are missing, so that misconfiguration is obvious rather than silent.
26. As the operator, I want a missing or unset `VAULT_PATH` to fall back to the Demo vault, so that the runtime is always runnable out of the box without private data.

## Implementation Decisions

Modules to build or modify:

- **Run-logger** — a deep module wrapping Mastra's pino logger that appends structured JSONL Run logs to the configured log directory. Interface: accepts a run identifier and structured event records; outputs newline-delimited JSON to a file under the gitignored log directory; resolves its destination from configuration, defaulting to a local logs directory. It hides file handling and serialization behind a small, stable surface so callers only emit events.
- **Config/env loader** — resolves runtime settings from `.env` plus a tracked default config and an optional untracked local override. Interface: inputs are environment variables and config files; outputs a validated settings object exposing the model provider key (optional), the Vault path, the log directory, and the log level. Missing required values produce a clear error; an unset Vault path resolves to the Demo vault.
- **Demo workflow** — a deterministic workflow that performs repeatable, code-only work (no model call) and emits Run logs, used as the CI-safe smoke path. Interface: inputs are static demo parameters; output is a structured result plus logged events.
- **Demo agent and tool** — a single minimal agent wired to the OpenAI provider with one trivial tool, exercised only by the local demo script. Interface: the agent takes a prompt and returns a completion; the tool exposes one deterministic operation the agent may call.
- **Demo vault fixtures** — a small set of clearly fake notes under the examples directory, consumed by tests and demos as the safe stand-in for the real Vault.
- **Repo-governance docs and templates** — the operating rules, agent rules, issue and pull-request templates, and contributor-facing setup docs.
- **CI and secret-scan** — a continuous-integration workflow that installs, typechecks, lints, builds, and runs unit tests with no secrets, plus a separate gitleaks scan job.

Architectural and boundary decisions:

- The runtime is built on Mastra (see ADR 0001). Agents, tools, and workflows follow Mastra primitives.
- The public-safe boundary follows ADR 0002: the real Vault is never tracked and is reached only via `VAULT_PATH`; the Demo vault is committed; Run logs and runtime state are gitignored.
- The OpenAI provider is the default. The Phase 1 milestone proves a real LLM call locally, but that call lives only in the local demo script and is never executed in CI, keeping CI key-free.
- Dangerous-capabilities approval is recorded as documented policy in this milestone (in agent and repo rules), not a runtime approval gate. Runtime gating is deferred to a later phase with delegation.
- GitHub is the build system of record; project tracking is configured through GitHub Issues, Projects, and pull requests rather than bespoke tooling.

## Testing Decisions

- Good tests verify external behavior through public interfaces, not implementation details. Tests assert on emitted Run-log records and workflow outputs, not on private file-handling internals.
- Tested modules for this milestone: the Run-logger and the deterministic demo workflow. Both run without any model key so they are safe for CI and a fresh machine.
- The demo agent's real LLM call is intentionally not covered by automated tests in this milestone; it is exercised manually through the local demo script.
- System-boundary concerns: tests point the runtime at the committed Demo vault and a temporary log directory, isolating them from the operator's real Vault and from any network or model calls.
- Prior art does not yet exist in the repo; these become the reference tests for future capabilities.

## Out of Scope

- Engineering Lead agent and the first end-to-end engineering loop — deferred to Phase 2.
- Seed skills, the skill folder convention, and the agent registry — deferred to Phase 3.
- Sessions, delegation, job queues, and runtime approval gating for dangerous capabilities — deferred to Phase 4 and Phase 5.
- Staging, review, promotion, and controlled restart flows — deferred to Phase 5.
- The full YAML skill platform — deferred to Phase 6.
- Authoring agents and the Chief of Staff router — deferred to Phases 7 and 8.
- Obsidian integration against the real Vault, inbox triage, and the structured wiki — deferred to Phase 9; only the fake Demo vault is in scope now.
- Scheduled jobs, cron/launchd, and webhooks — deferred to Phase 10.
- Rich Mastra telemetry/tracing beyond basic JSONL Run logs — deferred; only basic logging is in scope now.

## Further Notes

- Assumption: `npm create mastra` may generate example agents, memory, or telemetry that exceed the minimal slice; the build trims these down and records removals in the relevant commit.
- Assumption: the public repository is created via the GitHub CLI when authenticated, with a fallback to local commits plus documented push steps if it is not.
- Risk: scaffolder bloat conflicting with the do-not-overbuild principle — mitigated by trimming to one demo agent, one tool, and one workflow.
- Risk: accidental secret or Vault leakage — mitigated by `.gitignore` rules, `.env.example`-only policy, gitleaks CI, and a recommendation to enable GitHub native push protection.
- Open question: whether to also enable GitHub native secret scanning in addition to gitleaks; recommended, configured in the GitHub UI after the repo exists.
