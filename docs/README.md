# MichaelOS Documentation

## Work tracking

**GitHub Issues + the MichaelOS Build project are the source of truth** for all buildable work (per `init.md` rule 2 and `AGENTS.md`).

Stable backlog IDs (`BL-NNN`) live in issue titles, e.g. `[BL-004] First end-to-end engineering loop`. Do not renumber them.

### Flow

1. **Issue** — what and why (use templates under `.github/ISSUE_TEMPLATE/`)
2. **Project** — where in the flow (MichaelOS Build board)
3. **PR** — how it lands (`Closes #N` in the PR body)

| Column | Meaning |
|--------|---------|
| Backlog | Captured, not ready to build |
| Ready | Spec/acceptance criteria clear; can start |
| In Progress | Active branch / implementation |
| Review | PR open, CI running |
| Done | Merged and issue closed |

### Labels and milestones

- **Phase labels:** `phase-1` … `phase-9` (see repo Labels)
- **Type labels:** `enhancement`, `runtime`, `spec`, `bug`, `docs`, `ci`
- **Milestones:** one per active phase (e.g. `Phase 2 - First engineering loop`)

### Migrated backlog (issues)

| ID | Issue |
|----|-------|
| BL-003 | [#1](https://github.com/mikebrowne/michael-os/issues/1) |
| BL-004 | [#2](https://github.com/mikebrowne/michael-os/issues/2) |
| BL-005 | [#3](https://github.com/mikebrowne/michael-os/issues/3) |
| BL-006 | [#4](https://github.com/mikebrowne/michael-os/issues/4) |
| BL-007 | [#5](https://github.com/mikebrowne/michael-os/issues/5) |
| BL-008 | [#6](https://github.com/mikebrowne/michael-os/issues/6) |
| BL-009 | [#7](https://github.com/mikebrowne/michael-os/issues/7) |
| BL-010 | [#8](https://github.com/mikebrowne/michael-os/issues/8) |

**Next build:** [BL-004 / issue #2](https://github.com/mikebrowne/michael-os/issues/2) — move to **Ready** on the board when starting Phase 2.

## GitHub Projects setup

GitHub Projects is the kanban for buildable work:

1. Open the repository on GitHub → **Projects** → **MichaelOS Build**.
2. Columns: **Backlog**, **Ready**, **In Progress**, **Review**, **Done**.
3. Enable **Auto-add to project** for new Issues (Project settings → Workflow → Item added to repository).
4. New issues from templates should land on the board automatically; otherwise add via the issue sidebar → **Projects**.

To add issues from the CLI, `gh` needs project scopes:

```bash
gh auth refresh -s read:project,project
gh project list --owner mikebrowne
gh project item-add <project-number> --owner mikebrowne --url https://github.com/mikebrowne/michael-os/issues/<N>
```

## Creating issues (no CLI required)

You do **not** need `gh` to track work. Use the GitHub web UI:

1. Open the repo → **Issues** → **New issue**.
2. Pick a template: **Bug**, **Feature**, **Spec**, or **Capability idea** (defined under `.github/ISSUE_TEMPLATE/`).
3. Fill in the form and submit.
4. In the issue sidebar, under **Projects**, add it to **MichaelOS Build** (or rely on auto-add if you enabled that workflow).

`gh` is optional convenience for the same workflow from a terminal, for example:

```bash
gh issue create --template bug.yml
gh issue list
```

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
