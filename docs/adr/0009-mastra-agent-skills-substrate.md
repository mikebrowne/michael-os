# Adopt Mastra Agent Skills as the skill substrate

Through Phase 5, MichaelOS skills were hand-rolled: `SKILL.md` files parsed by a bespoke
`src/skills/skillLoader.ts`, with **every** skill body eagerly concatenated into the Engineering
Lead's system prompt at construction (`loadEngineeringSkillBodies()` over a hardcoded `SKILL_NAMES`
list). Phase 6 ("skills become first-class reusable system objects") could have grown that custom
layer into a full platform (a registry, an index, progressive loading, validation, permissions,
telemetry). Per the **framework-first** rule we checked the *installed* framework first, and found
that `@mastra/core@^1.46` already ships a complete **Agent Skills** system implementing the
[Agent Skills spec](https://agentskills.io): `SKILL.md` directory bundles (`references/`, `scripts/`,
`assets/`), frontmatter validation (`validateSkillMetadata` + `SKILL_LIMITS`), a skill **index**
(`workspace.skills.list` / `get` / `search` with vector/bm25/hybrid), **progressive loading** via
auto-injected agent tools (`skill` loads full instructions on demand, `skill_search`, `skill_read`),
**shared vs agent-specific scoping** (`workspace.skills` merged with per-agent `Agent.skills`, which
accepts a dynamic resolver keyed off `requestContext`), inline skills (`createSkill`),
`skillsFormat` for index injection, and versioning/publishing (`VersionedSkillSource`,
`publishSkillFromSource`). We therefore **adopt Mastra Agent Skills as the substrate** and **retire**
`skillLoader.ts` and the eager full-body concat, wrapping Mastra in a thin **`skillRegistry` /
`SkillRegistration`** anti-corruption layer that keeps our domain nouns on top and makes future
framework churn a localized edit. This delivers ~7 of the 9 Phase 6 user stories (YAML format,
shared skills, agent-specific skills, index, progressive loading, validation, script-backed bundles)
as reuse-with-wrapper, so the real Phase 6 build collapses to the **domain gaps** Mastra does not
own: authority/permission gating (ADR 0010), Job-correlated skill telemetry, the Skill Engineer
agent, and skill EDD. The existing 7 skills migrate at once (no backward-compat shim — single
operator, reversible via git); the riskiest step, removing the eager concat in favour of on-demand
loading, is pinned by a **migration regression eval** that must be green. We keep `skillsFormat:
markdown` for index injection (consistent with the current prompt style and eyeball-able in traces),
and we deliberately do **not** execute a bundle's `scripts/` folder — deterministic muscle stays in
**promoted Tools** built by the Engineering Department, preserving the determinism ratchet in
`CONTEXT.md`. The trade-off is a hard dependency on a fast-moving framework primitive and the loss of
our own loader's simplicity; we accept this because reuse is the house rule's named example for "the
full skill system," the thin `skillRegistry` seam bounds the blast radius of version changes, and a
spec-compliant frontmatter (domain fields ride in the arbitrary `metadata` map) keeps our skills
portable.

Considered alternatives: **keep hand-rolling the platform** (grow `skillLoader.ts` into a registry +
index + progressive loader) — rejected; it re-implements, less robustly, a primitive the installed
framework already provides, directly violating framework-first. **Reuse Mastra but keep the eager
concat** (use the index for discovery yet still inject all bodies) — rejected; it forfeits the whole
point of progressive loading (token cost, context bloat) and the determinism-ratchet signal of
*which* skills an agent actually activates. **Pin to the Agent Skills spec but write our own parser**
(ignore Mastra's runtime) — rejected; we would still hand-roll discovery, search, and the
progressive tools, gaining nothing over the wrapper. **Defer Phase 6 until the loop is more proven**
(the old `skills/README.md` stance) — rejected; Phase 5 shipped, the eager concat is already a
scaling problem, and the framework support makes now the cheap moment to pivot. **Move skill bodies
into YAML** (literal reading of the "YAML skill format" story) — rejected; the SOP stays
human-reviewable markdown, and "YAML skill format" is satisfied by a richer, validated YAML
frontmatter.
