# MichaelOS Foundation: Locked Decisions

These decisions came out of the grill-with-docs session and must not be re-litigated during implementation. Source links: `docs/prds/michael-os-foundation.md`, `docs/adr/0001-mastra-runtime.md`, `docs/adr/0002-public-safe-vault-boundary.md`, `CONTEXT.md`.

| ID | Decision | Source |
|----|----------|--------|
| LD-01 | Stand up the runtime by running `npm create mastra` and trimming generated cruft, rather than hand-rolling. Package manager is npm. | Grill Q1; ADR 0001 |
| LD-02 | Default model provider is OpenAI; `OPENAI_API_KEY` is a placeholder in `.env.example`. | Grill Q2; PRD |
| LD-03 | The Phase 1 milestone proves a real LLM call locally, but that call lives only in the local demo script and is never run in CI. CI stays key-free. | Grill Q2; PRD Testing Decisions |
| LD-04 | Public-safe boundary: committed fake Demo vault at `examples/demo-vault/`; real Vault outside the repo via `VAULT_PATH`; Run logs to gitignored `./.logs/`; runtime state in gitignored `.mastra/`; local config via `.env` + gitignored `config/local.*`. | Grill Q3; ADR 0002 |
| LD-05 | `git init` locally, then create the public GitHub repo via the GitHub CLI (when authenticated) and push; fallback to local commits + documented push steps if not authenticated. | Grill Q4 |
| LD-06 | Repo name is `michael-os`; license is MIT. | Grill Q4 |
| LD-07 | Secret safety uses a gitleaks CI job plus a recommendation to enable GitHub native push protection. | Grill Q4; PRD |
| LD-08 | Dangerous-capabilities approval is documented policy (AGENTS.md + Cursor rules + CI) in this milestone, not a runtime gate. Runtime gating is deferred to later phases. | PRD Implementation Decisions |
| LD-09 | Scope is Phase 0 and Phase 1 only — a clean foundation, not the agent organization. No Chief of Staff, delegation, job queues, Obsidian integration, scheduled jobs, authoring agents, or the full skill system. | User brief; PRD Out of Scope |
