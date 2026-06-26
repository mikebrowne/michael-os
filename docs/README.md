# MichaelOS Documentation

## GitHub Projects setup

GitHub Projects is the kanban for buildable work. Configure it in the GitHub UI after the repository exists:

1. Open the repository on GitHub → **Projects** → **New project**.
2. Choose **Board** (or Table) and name it **MichaelOS Build**.
3. Add columns: **Backlog**, **Ready**, **In Progress**, **Review**, **Done**.
4. Enable **Auto-add to project** for new Issues (Project settings → Workflow → Item added to repository).
5. Link Issues from templates (bug, feature, spec, capability idea) as they are created.
6. Reference `docs/BACKLOG.md` for deferred cross-phase items (`BL-NNN`).

## Key docs

| Doc | Purpose |
|-----|---------|
| [CONTEXT.md](../CONTEXT.md) | Domain glossary |
| [AGENTS.md](../AGENTS.md) | Operating rules for humans and agents |
| [init.md](../init.md) | Full build plan (Phases 0–14) |
| [docs/prds/michael-os-foundation.md](./prds/michael-os-foundation.md) | Phase 0/1 product PRD |
| [docs/local-dev.md](./local-dev.md) | Mac mini / local setup |
| [docs/push-to-github.md](./push-to-github.md) | Manual GitHub push steps |
| [docs/adr/](./adr/) | Architecture decisions |

## ADRs

- [0001 — Mastra runtime](./adr/0001-mastra-runtime.md)
- [0002 — Public-safe Vault boundary](./adr/0002-public-safe-vault-boundary.md)
