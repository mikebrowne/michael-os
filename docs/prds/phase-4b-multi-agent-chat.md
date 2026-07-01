# Objective

Ship Phase 4b: **Multi-Agent Chat and the Engagement Manager** — a conversational front door that
supports multiple direct-chat agents, coordinates intake through the **Engagement Manager**, runs
**build-vs-reuse triage**, records **necessity verdicts**, and routes to the right specialist.

# Background

Phase 3 reserved `directChat` / `standalone` on `agentRegistry` so multi-route chat would be a config
flip + REPL change ([phase-3-engineering-department.md](../phase-3-engineering-department.md)). Phase 4
deferred multi-route gateway and the Necessity Reviewer to 4b ([phase-4-delegation-jobs.md](../phase-4-delegation-jobs.md)).
Phase 6 shipped the Skill Engineer with `directChat: true` and a separate `skill-gateway` script.
Phase 6.5 shipped `runComprehension` for reuse discovery ([ADR 0012](../adr/0012-cursor-comprehension-mode.md)).

See [Phase 4b north star](../phase-4b-multi-agent-chat.md), [grill notes](./phase-4b-multi-agent-chat.grill.md),
[ADR 0015](../adr/0015-multi-route-gateway-chat.md), [ADR 0016](../adr/0016-engagement-manager-triage-verdicts.md).

# Requirements

## ADRs + vocabulary (Slice 0 — BL-015a)

- **ADR 0015** — multi-route gateway chat & thread model.
- **ADR 0016** — Engagement Manager triage & necessity verdicts.
- `CONTEXT.md`: **Direct-chat route**, **Necessity verdict**, **gatewayRouteRegistry**; refine Engagement Manager.
- `docs/README.md` backlog (**BL-015** epic + slices); ADR index.

## Multi-route gateway (Slice 1 — BL-015b)

- `gatewayRouteRegistry`: active agent + per-route thread ids in `.mastra/gateway-routes.json`.
- `@<agent-id>` switches route; `agents` lists `directChat: true` entries.
- Dynamic prompt prefix (`engagement-manager>`, etc.) in REPL, daemon, and chat client.
- Retire `scripts/skillGateway.ts` and `npm run skill-gateway`.

## Engagement Manager agent (Slice 2 — BL-015c)

- Bundle `agents/engagement-manager/agent.md` (`directChat: true`, `standalone: true`, employee).
- Mastra agent `createEngagementManagerAgent` registered in harness.
- Default gateway agent via `GATEWAY_DEFAULT_AGENT` (default `engagement-manager`).

## Routing (Slice 3 — BL-015d)

- EM as Mastra supervisor with Engineering Lead + Skill Engineer sub-agents.
- Route by role/skill/authority using registry metadata.

## Build-vs-reuse triage (Slice 4 — BL-015e)

- **Registry scan** tool — deterministic keyword match over agents/skills/tools.
- **Comprehension triage** tool — wraps `runComprehension`.
- **Framework-first check** — judgment with cited sources (no new scraper).
- Invoke **`author-policy`** skill for form selection.

## Necessity verdict (Slice 5 — BL-015f)

- Write `<stateDir>/<slug>/necessity-verdict.md` with decision, rationale, sources, timestamp.
- Emit `necessity.verdict` run-log event.
- Gateway `verdict` command for current work item.

## North-star verification (Slice 6 — BL-015g)

- Hash-locked acceptance test in CI.
- Update `agents/README.md`; mark north star complete.

# Acceptance criteria

- [ ] `@engineering-lead`, `@skill-engineer`, `@engagement-manager` switch routes with isolated threads.
- [ ] `agents` lists direct-chat agents from registry.
- [ ] EM is default gateway agent; `GATEWAY_DEFAULT_AGENT=engineering-lead` restores prior behavior.
- [ ] EM supervisor delegates to EL and Skill Engineer.
- [ ] Triage produces `necessity-verdict.md` and `necessity.verdict` event.
- [ ] `skill-gateway` removed; Skill Engineer reachable via main gateway.
- [ ] ADRs + vocabulary committed; acceptance test passes in CI.

# Test plan

| Test | CI | Local |
|------|-----|-------|
| Route switching + thread isolation | yes | — |
| `agents` command | yes | — |
| Registry scan deterministic | yes | — |
| Necessity verdict write | yes | — |
| Hash-locked acceptance test | yes | — |
| EM triage eval (reuse known skill) | — | yes |

# Verification commands

```bash
npm run typecheck
npm run lint
npm run test
npm run gateway   # @agents, @skill-engineer, chat with EM
```

# Out of scope

- HITL raise-to-operator; hard review gating; generalized checklist (Phase 4 deferrals → 4c+).
- Token streaming; multi-operator session isolation.
- Chief of Staff implementation (Phase 8) — boundary doc only.

This PRD contains no secrets or private data.
