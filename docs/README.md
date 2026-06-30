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
| BL-007 | [#5](https://github.com/mikebrowne/michael-os/issues/5) — **closed** (Phase 5 staging, review, promotion complete) |
| BL-007a | [#23](https://github.com/mikebrowne/michael-os/issues/23) — **closed** — Slice 0: ADRs, vocabulary, qa-engineer rename |
| BL-007b | [#24](https://github.com/mikebrowne/michael-os/issues/24) — **closed** — Slice 1: staging + PR promotion + rollback loop |
| BL-007c | [#25](https://github.com/mikebrowne/michael-os/issues/25) — **closed** — Slice 2: QA Engineer + first gates (CI + code review) |
| BL-007d | [#26](https://github.com/mikebrowne/michael-os/issues/26) — **closed** — Slice 3: security + permission gates + remote CI |
| BL-007e | [#27](https://github.com/mikebrowne/michael-os/issues/27) — **closed** — Slice 4: rollback & promotion ledger UX |
| BL-007f | [#28](https://github.com/mikebrowne/michael-os/issues/28) — **closed** — Slice 5: controlled restart flow |
| BL-007g | [#29](https://github.com/mikebrowne/michael-os/issues/29) — **closed** — Slice 6: north-star verification |
| BL-007h | [#30](https://github.com/mikebrowne/michael-os/issues/30) — **closed** — Rejection & remediation loop + approval audit (red/no path) |
| BL-008 | [#6](https://github.com/mikebrowne/michael-os/issues/6) — Phase 6 Skill Platform epic (grilled 2026-06-28) |
| BL-008a | [#31](https://github.com/mikebrowne/michael-os/issues/31) — Slice 0: ADRs 0009/0010 + vocabulary |
| BL-008b | [#32](https://github.com/mikebrowne/michael-os/issues/32) — Slice 1: Mastra Agent Skills substrate + `skillRegistry` + migration |
| BL-008c | [#33](https://github.com/mikebrowne/michael-os/issues/33) — Slice 2: scope + permission/authority enforcement |
| BL-008d | [#34](https://github.com/mikebrowne/michael-os/issues/34) — Slice 3: skill telemetry (five `skill.*` events) |
| BL-008e | [#35](https://github.com/mikebrowne/michael-os/issues/35) — Slice 4: Skill Engineer agent + lighter-gate lifecycle |
| BL-008f | [#36](https://github.com/mikebrowne/michael-os/issues/36) — Slice 5: skill EDD harness + tool test-mode/mock |
| BL-008g | [#37](https://github.com/mikebrowne/michael-os/issues/37) — Slice 6: north-star verification |
| BL-009 | [#7](https://github.com/mikebrowne/michael-os/issues/7) |
| BL-010 | [#8](https://github.com/mikebrowne/michael-os/issues/8) |
| BL-011 | [#38](https://github.com/mikebrowne/michael-os/issues/38) — deferred: adapt-from-external-skill |
| BL-012 | [#39](https://github.com/mikebrowne/michael-os/issues/39) — deferred: aggregate skill metrics |
| BL-013 | [#40](https://github.com/mikebrowne/michael-os/issues/40) — Phase 7: enforce tool test-mode/mock contract (folds into BL-014d Tool Author) |
| BL-014 | _to file_ — Phase 7: Authoring Agents epic (grilled 2026-06-30; slices `BL-014a..g`) |

**Next build:** [BL-014](./prds/phase-7-authoring-agents.md) — Phase 7 Authoring Agents (slices `BL-014a..g`, issues _to file_ — see [issues doc](./prds/phase-7-authoring-agents.issues.md)). Phase 6 (BL-008) and Phase 6.5 (steerable loop) shipped — see the [Phase 6.5 north star](./phase-6.5-steerable-loop.md). Phase 7 grilled 2026-06-30 — see [Phase 7 north star](./phase-7-authoring-agents.md), [grill notes](./prds/phase-7-authoring-agents.grill.md).

## Key docs

| Doc | Purpose |
|-----|---------|
| [phase-2-engineering-loop.md](./phase-2-engineering-loop.md) | Phase 2 north star, grill decisions, delivery slices |
| [phase-3-engineering-department.md](./phase-3-engineering-department.md) | Phase 3 north star, department roster, delivery slices |
| [phase-4-delegation-jobs.md](./phase-4-delegation-jobs.md) | Phase 4 north star, jobs, observability, delegation |
| [phase-5-staging-review-promotion.md](./phase-5-staging-review-promotion.md) | Phase 5 north star, staging, QA Engineer gates, promotion, rollback, restart |
| [phase-6-skill-platform.md](./phase-6-skill-platform.md) | Phase 6 north star, Mastra Agent Skills substrate, Skill Engineer, EDD, telemetry |
| [phase-6.5-steerable-loop.md](./phase-6.5-steerable-loop.md) | Phase 6.5 north star, steerable builds (plan-and-slice), Cursor comprehension mode, 100%-off-IDE exit criteria |
| [phase-7-authoring-agents.md](./phase-7-authoring-agents.md) | Phase 7 north star, autonomous authoring (Skill/Tool/Workflow Author + Hiring), safe activation, agent bundles |
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
- [0007 — PR-based staging, promotion & rollback](./adr/0007-pr-staging-promotion.md)
- [0008 — QA Engineer verification model](./adr/0008-qa-engineer-verification.md)
- [0009 — Mastra Agent Skills substrate](./adr/0009-mastra-agent-skills-substrate.md)
- [0010 — Skill permission/authority & lighter-gate lifecycle](./adr/0010-skill-permission-lifecycle.md)
- [0011 — Steerable builds: EL owns the plan, SWE executes bounded slices](./adr/0011-steerable-builds-plan-and-slice.md)
- [0012 — Cursor harness for codebase comprehension & reuse discovery](./adr/0012-cursor-comprehension-mode.md)
- [0013 — Autonomous authoring & safe activation](./adr/0013-autonomous-authoring-safe-activation.md)
- [0014 — Agents as committed bundles, dynamically registered via Mastra](./adr/0014-agent-bundles-dynamic-registration.md)
