# Objective

Define the decisions and scope for **Phase 4b: Multi-Agent Chat and the Engagement Manager** — a
single conversational front door that can talk to more than one agent, with a coordinator that routes
incoming work and runs build-vs-reuse triage.

Synthesized from the grill session on 2026-07-01. Builds on
[Phase 3](../phase-3-engineering-department.md) (`directChat` / `standalone` registry fields),
[Phase 4](../phase-4-delegation-jobs.md) (sessions, delegation, jobs), [Phase 6](../phase-6-skill-platform.md)
(`skillRegistry`, Skill Engineer), and [Phase 6.5](../phase-6.5-steerable-loop.md) (comprehension mode).

**Sequencing:** Phase 4b is **next build** as epic **[BL-015]** (Phase 7 BL-014 docs remain; implementation yields).

**Scope:** Strict [`init.md` Phase 4b](../../init.md) — multi-chat, Engagement Manager, routing,
build-vs-reuse triage, necessity verdict artifact, Chief of Staff boundary doc. Explicitly **out:**
HITL raise-to-operator, hard review gating, generalized checklist (→ Phase 4c / later).

# Decisions

## North star & guiding principles

- **North star:** The operator talks to the **Engagement Manager** as the engineering front door; can
  `@switch` to any `directChat` specialist; receives a recorded **build / reuse / adapt** necessity
  verdict before work is routed.
- **Framework-first:** routing via Mastra **supervisor agents**; memory via Mastra Memory; comprehension
  via existing `runComprehension`; agent registration via committed bundles ([ADR 0014](../adr/0014-agent-bundles-dynamic-registration.md)).
- **Phase 4b / Phase 8 seam:** Engagement Manager = engineering-scoped intake + simple routing + reuse
  triage; Chief of Staff (Phase 8) = org-wide intelligent routing + delegation summaries.

## D1 — Default front door

- **Engagement Manager** is the default gateway agent once shipped (`GATEWAY_DEFAULT_AGENT=engagement-manager`).
- **Engineering Lead** remains reachable via `@engineering-lead` for operators who want to skip intake.
- Rollback flag: `GATEWAY_DEFAULT_AGENT=engineering-lead` restores Phase 3 behavior without code changes.

## D2 — Multi-chat UX

- Operator switches with **`@<agent-id>`** (e.g. `@skill-engineer`, `@engineering-lead`).
- **`agents`** command lists every registry entry with `directChat: true` (id, role, description).
- Prompt prefix shows active agent: `engagement-manager>`, `engineering-lead>`, etc.

## D3 — Thread / memory model

- **One Mastra thread per direct-chat route** (`resource: operator`); extends [ADR 0006](../adr/0006-gateway-session-memory.md).
- Persist active route + per-agent thread map in **`.mastra/gateway-routes.json`** via thin
  `gatewayRouteRegistry` wrapper.
- Switching routes switches `{ thread, resource }` passed to `agent.generate()` — no cross-agent working-memory bleed.

## D4 — Daemon behavior

- Single shared daemon runtime (same as today); all TCP clients share active route + approval state.
- Daemon welcome banner lists `@agent` switching + `agents` command.
- Job/restart/build broadcast headlines unchanged.

## D5 — Retire `skillGateway.ts`

- Fold Skill Engineer direct chat into the main gateway (`npm run gateway` / daemon / `npm run chat`).
- Remove `npm run skill-gateway` script after parity; update `skills/README.md`.

## D6 — Engagement Manager architecture

- New **`engagement-manager`** agent bundle + Mastra agent; **`authority: employee`**, `directChat: true`,
  `standalone: true`.
- Mastra **supervisor** with sub-agents: **Engineering Lead** + **Skill Engineer** ([ADR 0005](../adr/0005-agentic-orchestration-layer.md)).
- Intake flow: restate need → build-vs-reuse triage → route to specialist (no inline building).

## D7 — Build-vs-reuse triage sources

Three sources (determinism ratchet):

1. **Registries (deterministic)** — scan `agentRegistry`, `skillRegistry`, known tool ids for keyword matches.
2. **Comprehension (judgment)** — `runComprehension` read-only mode ([ADR 0012](../adr/0012-cursor-comprehension-mode.md)).
3. **Framework-first (judgment)** — agent cites Mastra/docs patterns; no new scraper in 4b.

Cheap lookups first; comprehension only when registries are inconclusive.

## D8 — Necessity verdict artifact

- Markdown at **`<stateDir>/<work-item-slug>/necessity-verdict.md`** with frontmatter:
  `decision: build | reuse | adapt`, `rationale`, `sources[]`, `timestamp`, optional `routedTo`.
- Correlated **`necessity.verdict`** run-log JSONL event (session / work-item slug / decision).
- Gateway **`verdict`** command prints the latest verdict for the current work item.

## D9 — Authoring-policy reuse

- EM **invokes** the **`author-policy`** skill for form-selection judgment (skill vs tool vs workflow vs agent).
- No duplicate form-selection logic in EM instructions.

## D10 — Chief of Staff boundary

- Document in north star + PRD: EM = engineering department front door; CoS = org-wide router (Phase 8).
- EM does **not** produce delegation summaries or cross-department context routing.

## D11 — Explicit out of scope

- HITL raise-to-operator + multi-channel (Phase 4 deferral → 4c+).
- Hard (blocking) review gating; generalized expected-outputs checklist.
- Token streaming replies; multi-operator session isolation.
- Necessity Reviewer as a separate second job kind (EM subsumes the role).

# Delivery slices (issues)

| Slice | ID | Deliverable |
|-------|-----|-------------|
| 0 | BL-015a | ADRs 0015/0016 + vocabulary + docs index |
| 1 | BL-015b | Multi-route gateway plumbing |
| 2 | BL-015c | Engagement Manager agent bundle + registration |
| 3 | BL-015d | Supervisor routing to EL + Skill Engineer |
| 4 | BL-015e | Build-vs-reuse triage tools |
| 5 | BL-015f | Necessity verdict artifact + telemetry |
| 6 | BL-015g | North-star verification + CoS boundary |

# Issues

- Epic **[BL-015]** + slices **BL-015a..g** — see [issues doc](./phase-4b-multi-agent-chat.issues.md).
