# AGENTS.md

Operating rules for humans and agents working in the MichaelOS repository.

## Always-on build rules

1. **Public-safe by default** — No private Vault data, API keys, logs, traces, webhook URLs, journal entries, personal data, or sensitive config in the tracked repo.
2. **GitHub is the build system of record** — Buildable work becomes Issues, specs, PRs, commits, project items, CI checks, or reviewable diffs.
3. **Private data stays outside the repo** — Vaults, private logs, traces, local config, and runtime state remain untracked.
4. **Secrets are referenced, never exposed** — Use `.env` locally; commit `.env.example` only; never expose secret values.
5. **Agents propose changes through reviewable artifacts** — Specs, Issues, diffs, PRs, promotion requests.
6. **Dangerous capabilities require approval** — See the policy list below.
7. **Observability expands with capability** — Every new feature should add telemetry.
8. **Build thin vertical slices** — Complete loops first, then deepen each layer.
9. **Code for deterministic work; LLMs for judgment** — Repeatable operations in code; judgment calls to models.
10. **Everything should be reversible** — Git, tests, CI, rollback, promotion history.

## Dangerous capabilities (approval required)

These actions require explicit operator approval before execution. In Phase 0/1 this is documented policy; runtime gating arrives in later phases.

- Shell execution
- Dependency installation
- File deletion
- Permission expansion
- External writes (outside the repo or to untracked paths)
- Sending messages (email, chat, webhooks)
- Harness restarts
- Secrets access (reading `.env` values, printing keys)

## Domain vocabulary

Use terms from `CONTEXT.md` verbatim:

- **MichaelOS / the harness** — the local-first runtime and organization it hosts
- **Vault** — the operator's private Obsidian vault (never committed)
- **Demo vault** — fake, public-safe sample at `examples/demo-vault/`
- **Operator** — the single human who runs the harness
- **Run log** — structured JSONL records in gitignored `./.logs/`

## Public-safe boundary

- Real Vault: referenced only via `VAULT_PATH` in `.env` (never committed)
- Demo vault: committed fake data for tests and demos
- Run logs: `./.logs/` (gitignored)
- Runtime state: `.mastra/` (gitignored)
- Local config: `config/local.*` (gitignored)

## What not to build in this milestone

Chief of Staff, delegation, job queues, Obsidian integration against the real Vault, scheduled jobs, authoring agents, and the full skill system are out of scope for Phase 0/1.
