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
| BL-004 | [#2](https://github.com/mikebrowne/michael-os/issues/2) — **closed** (Phase 2 engineering loop complete) |
| BL-005 | [#3](https://github.com/mikebrowne/michael-os/issues/3) — **closed** (Phase 3 Engineering Department complete) |
| BL-005a | [#13](https://github.com/mikebrowne/michael-os/issues/13) — **closed** — registry + Code Reviewer |
| BL-005b | [#14](https://github.com/mikebrowne/michael-os/issues/14) — **closed** — always-on gateway |
| BL-005c | [#15](https://github.com/mikebrowne/michael-os/issues/15) — **closed** — resume → ship manifest |
| BL-005d | [#16](https://github.com/mikebrowne/michael-os/issues/16) — **closed** — naming convention rule |
| BL-006 | [#4](https://github.com/mikebrowne/michael-os/issues/4) — **closed** (Phase 4 delegation + jobs complete) |
| BL-006a | [#18](https://github.com/mikebrowne/michael-os/issues/18) — **closed** — observability substrate |
| BL-006b | [#19](https://github.com/mikebrowne/michael-os/issues/19) — **closed** — job system |
| BL-006c | [#20](https://github.com/mikebrowne/michael-os/issues/20) — **closed** — agentic delegation |
| BL-006d | [#21](https://github.com/mikebrowne/michael-os/issues/21) — **closed** — delegation eval + CI test |
| BL-006e | [#22](https://github.com/mikebrowne/michael-os/issues/22) — **closed** — authority + vocabulary |
| BL-007 | [#5](https://github.com/mikebrowne/michael-os/issues/5) |
| BL-008 | [#6](https://github.com/mikebrowne/michael-os/issues/6) |
| BL-009 | [#7](https://github.com/mikebrowne/michael-os/issues/7) |
| BL-010 | [#8](https://github.com/mikebrowne/michael-os/issues/8) |

**Next build:** [BL-007 / issue #5](https://github.com/mikebrowne/michael-os/issues/5) — Staging, review, and promotion (Phase 5). Phase 4b (Necessity Reviewer, multi-route chat) tracked separately.

## Key docs

| Doc | Purpose |
|-----|---------|
| [phase-2-engineering-loop.md](./phase-2-engineering-loop.md) | Phase 2 north star, grill decisions, delivery slices |
| [phase-3-engineering-department.md](./phase-3-engineering-department.md) | Phase 3 north star, department roster, delivery slices |
| [phase-4-delegation-jobs.md](./phase-4-delegation-jobs.md) | Phase 4 north star, jobs, observability, delegation |
| [CONTEXT.md](../CONTEXT.md) | Domain glossary |
| [AGENTS.md](../AGENTS.md) | Operating rules for humans and agents |
| [init.md](../init.md) | Full build plan (Phases 0–14) |
| [prds/michael-os-foundation.md](./prds/michael-os-foundation.md) | Phase 0/1 product PRD |
| [local-dev.md](./local-dev.md) | Mac mini / local setup |
| [push-to-github.md](./push-to-github.md) | Manual GitHub push steps |
| [adr/](./adr/) | Architecture decisions |

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

## ADRs

- [0001 — Mastra runtime](./adr/0001-mastra-runtime.md)
- [0002 — Public-safe Vault boundary](./adr/0002-public-safe-vault-boundary.md)
- [0003 — Cursor coding executor](./adr/0003-cursor-coding-executor.md)
- [0004 — Engineering Department structure](./adr/0004-engineering-department-structure.md)
- [0005 — Agentic orchestration layer](./adr/0005-agentic-orchestration-layer.md)
- [0006 — Gateway session memory](./adr/0006-gateway-session-memory.md)
