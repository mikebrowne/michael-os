# Agents as committed bundles, dynamically registered via Mastra

Today an agent exists only because someone wrote a TypeScript file (`src/mastra/agents/*.ts`) and
restarted the harness, and the agent roster is the hand-maintained `AGENT_REGISTRY` array in
`agentRegistry.ts`. For the system to **hire** a new agent *safely and on its own* (Phase 7), two things
about that are wrong: the system would have to write **code** to create a colleague, and adding one
forces a **restart**. **Decision:** make an agent a **bundle** — a folder with a config "job
description" file, exactly mirroring skill bundles — and make the **committed bundle the single source
of truth**, with `agentRegistry` demoted to a **derived, validated view** (the identical move Phase 6
made when skill frontmatter became the source of truth and `agentRegistry` became a projection). An
agent bundle is `agents/<id>/agent.(yaml|md)` (role, authority, model, tools, skills, `directChat`,
`standalone`) plus the agent's own workspace folder for its agent-scoped skills / examples / evals /
memory config. **Adding or changing an agent requires no `.ts` edits** — it is a reviewable, public-safe,
git-reversible document, and "firing"/rollback is just removing or deactivating the folder. The
**runtime mechanism reuses Mastra** rather than hand-rolling a loader: the installed Mastra exposes
`Mastra.addAgent(agent, key?, { source: "code" | "stored" })` to register an agent into a **running**
instance (no restart), and **Stored Agents** / `MastraEditor` (PR #10953) to instantiate a
config-defined agent and **resolve its tools / workflows / sub-agents / memory from the registry**, with
versioning. A thin anti-corruption wrapper reads the **committed bundles** and registers them through
Mastra; the gitignored `.mastra/` store is a **throwaway cache, never the truth**. For loading, the
**reliable baseline is scan-the-folder-at-startup**, so the Phase 5 **controlled restart** always works
("approve job description → controlled restart → agent live"); **live slot-in without a restart is a
bonus** attempted only if the installed Mastra supports it cleanly. The **authority** declared in a
bundle is **validated** the same way skills are — an `employee` agent structurally cannot be granted
management-only tools (reuse the Phase 6 authority invariant) — and a hired agent only goes active after
passing its **onboarding smoke-test** (ADR 0013 / the hiring-vs-onboarding split).

Considered alternatives. **Agent-as-code through the full code pipeline** — rejected for the *default*
hiring path; it forces the system to write `.ts` to create a colleague and contradicts the operator's
"agents should be reviewable config files, not code" intent and the `init.md` note about
YAML-defined agents; the agent-bundle approach is more reviewable and far more reversible. (The
**loader** and any shared agent infrastructure are, of course, still ordinary code that ships through the
full pipeline — only the *individual agent definitions* become bundles.) **Mastra's database-backed
Stored Agents as the source of truth** — rejected; it persists the agent definition in **private,
gitignored runtime state**, so it is **not reviewable in a diff, not in git history, and not
public-safe**, cutting against bedrock rules (public-safe by default; agents propose via reviewable
artifacts; everything reversible). We **reuse Mastra's Stored-Agents/`addAgent` *machinery*** for runtime
instantiation and dependency resolution, but keep the **committed bundle** as the truth and treat the DB
as a cache. **Hand-rolling a bespoke YAML→agent loader** — rejected by framework-first; Mastra already
provides dynamic registration and dependency resolution, so we wrap it thinly instead of duplicating it.
**Requiring a full restart for every new agent** — rejected as the *ceiling* but kept as the *floor*:
the Phase 5 controlled restart is the dependable baseline, and we *upgrade* to live `addAgent`
registration where the installed SDK allows, without changing the source-of-truth design. The trade-off
we accept: a thin loader/projection layer and a validation pass over bundles (instead of a static array),
plus a dependency on Mastra's dynamic-agent API surface — accepted because it is a localized
anti-corruption wrapper (reversibility), it makes "the system writes a new colleague" possible without
code edits, and it is symmetric with the skill-bundle model the operator already likes.

Mechanism (verify against the installed version at build time — pinned `@mastra/core@^1.46`,
`mastra@^1.15`). Source of truth: `agents/<id>/agent.(yaml|md)` + workspace folder, discovered and
frontmatter/authority-validated into a derived `agentRegistry` view (mirror of `skillRegistry`).
Runtime: a thin loader maps each validated bundle to a Mastra agent and registers it via `addAgent`
(resolving tools/workflows/sub-agents/memory from the registry, the same resolution Stored Agents use);
startup scan is authoritative, controlled restart re-scans, live slot-in is attempted when supported.
Hiring drafts the bundle (the "job description," via the ADR 0013 proposal gate, optionally grilling the
operator with `grill-me-with-docs`); onboarding wires starter skills/memory and runs the smoke-test that
gates activation. See the [Phase 7 north star](../phase-7-authoring-agents.md) and
[PRD](../prds/phase-7-authoring-agents.md).
