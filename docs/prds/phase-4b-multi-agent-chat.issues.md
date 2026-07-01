# Phase 4b — Multi-Agent Chat + Engagement Manager: issues to file

Ready-to-file GitHub issues for Phase 4b (epic **BL-015** + slices **BL-015a..g**). File each via the
GitHub web UI or `github-create-issue`, then record issue numbers in the [backlog table](../README.md).
Keep the `[BL-NNN]` IDs; do not renumber.

- **Existing:** epic **BL-015 / #54** filed with slices **#55–#61**.

---

## EPIC — `[BL-015] Multi-Agent Chat + Engagement Manager`

**Labels:** `enhancement`, `spec`, `phase-4`

```md
## Phase
P4b — Multi-Agent Chat and the Engagement Manager

## Epic
A single conversational front door that can talk to more than one agent, with a coordinator — the
**Engagement Manager** — that routes incoming work and runs build-vs-reuse triage. **Grilled 2026-07-01.**

## North star
The operator talks to the Engagement Manager as the engineering front door, can `@switch` to any
`directChat` specialist, receives a recorded build/reuse/adapt necessity verdict, and work is routed
to the Engineering Lead or Skill Engineer. Each direct-chat agent keeps its own Mastra thread.

## Docs
- North star: `docs/phase-4b-multi-agent-chat.md`
- PRD: `docs/prds/phase-4b-multi-agent-chat.md`
- Grill notes: `docs/prds/phase-4b-multi-agent-chat.grill.md`
- ADR 0015 (multi-route gateway), ADR 0016 (EM triage + verdicts)

## Slices (sub-issues BL-015a..g)
- **BL-015a** Slice 0 — ADRs 0015/0016 + vocabulary + docs index
- **BL-015b** Slice 1 — multi-route gateway plumbing
- **BL-015c** Slice 2 — Engagement Manager agent bundle + registration
- **BL-015d** Slice 3 — supervisor routing to EL + Skill Engineer
- **BL-015e** Slice 4 — build-vs-reuse triage tools
- **BL-015f** Slice 5 — necessity verdict artifact + telemetry
- **BL-015g** Slice 6 — north-star verification + Chief of Staff boundary doc

## Acceptance criteria
- [ ] `@agent` switching with per-route threads; `agents` command
- [ ] EM default gateway agent; triage + necessity verdict on disk + run log
- [ ] EM routes to EL / Skill Engineer via supervisor delegation
- [ ] `skill-gateway` retired; ADRs + acceptance test in CI

## Deferred (4c / later)
HITL raise-to-operator, hard review gating, generalized checklist, streaming replies, multi-operator isolation.

This issue contains no secrets or private data.
```

---

## `[BL-015a] Phase 4b Slice 0 — ADRs 0015/0016 + multi-chat vocabulary`

**Labels:** `docs`, `spec`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope / deliverables
- ADR 0015 — multi-route gateway chat & thread model
- ADR 0016 — Engagement Manager triage & necessity verdicts
- `CONTEXT.md` nouns: Direct-chat route, Necessity verdict, gatewayRouteRegistry
- `docs/README.md` backlog + ADR index; next build → BL-015

## Acceptance criteria
- [ ] ADR 0015 + 0016 linked from docs/README.md
- [ ] CONTEXT.md vocabulary updated

This issue contains no secrets or private data.
```

---

## `[BL-015b] Phase 4b Slice 1 — multi-route gateway plumbing`

**Labels:** `enhancement`, `runtime`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Problem
Gateway is hardwired to Engineering Lead; Skill Engineer uses a separate script.

## Scope / deliverables
- `gatewayRouteRegistry` — active route + per-agent threads in `.mastra/gateway-routes.json`
- `@<agent-id>` switching; `agents` command; dynamic prompt prefix
- Update gateway REPL, daemon, chat client
- Retire `scripts/skillGateway.ts` and `npm run skill-gateway`

## Acceptance criteria
- [ ] `@skill-engineer` uses a distinct thread from `@engineering-lead`
- [ ] `agents` lists directChat registry entries
- [ ] Tests cover route switching

This issue contains no secrets or private data.
```

---

## `[BL-015c] Phase 4b Slice 2 — Engagement Manager agent`

**Labels:** `enhancement`, `runtime`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope / deliverables
- `agents/engagement-manager/agent.md` bundle (directChat, standalone, employee)
- `createEngagementManagerAgent` + harness registration
- `GATEWAY_DEFAULT_AGENT` env (default `engagement-manager`)

## Acceptance criteria
- [ ] EM appears in agentRegistry with directChat: true
- [ ] Gateway defaults to EM on fresh launch

This issue contains no secrets or private data.
```

---

## `[BL-015d] Phase 4b Slice 3 — supervisor routing`

**Labels:** `enhancement`, `runtime`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope
- EM Mastra supervisor with Engineering Lead + Skill Engineer sub-agents
- Route by role/skill/authority from registries

## Acceptance criteria
- [ ] EM can delegate to EL and SE via supervisor `agents` map
- [ ] Employee EM cannot invoke management-only tools directly

This issue contains no secrets or private data.
```

---

## `[BL-015e] Phase 4b Slice 4 — build-vs-reuse triage tools`

**Labels:** `enhancement`, `runtime`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope
- Registry scan tool (agents/skills/tools keyword match)
- Comprehension triage tool (wraps runComprehension)
- Framework-first judgment (cite sources; no scraper)
- EM invokes author-policy skill for form selection

## Acceptance criteria
- [ ] Registry scan is deterministic in CI tests
- [ ] Comprehension tool callable from EM (mocked in CI)

This issue contains no secrets or private data.
```

---

## `[BL-015f] Phase 4b Slice 5 — necessity verdict artifact`

**Labels:** `enhancement`, `runtime`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope
- Write `<stateDir>/<slug>/necessity-verdict.md`
- Emit `necessity.verdict` run-log event
- Gateway `verdict` command

## Acceptance criteria
- [ ] Verdict file schema matches ADR 0016
- [ ] Run log event correlated with work item slug

This issue contains no secrets or private data.
```

---

## `[BL-015g] Phase 4b Slice 6 — north-star verification`

**Labels:** `enhancement`, `docs`, `phase-4` · **Parent:** BL-015

```md
## Parent epic
BL-015 (#TBD)

## Scope
- Hash-locked acceptance test green in CI
- `agents/README.md` updated; Chief of Staff boundary in north star
- Mark `docs/phase-4b-multi-agent-chat.md` complete

## Acceptance criteria
- [ ] `npm run test` passes including acceptance test
- [ ] North-star checklist in phase doc satisfied

This issue contains no secrets or private data.
```
