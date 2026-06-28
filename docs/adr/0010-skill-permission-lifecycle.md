# Skill permission/authority model & lighter-gate lifecycle

Adopting Mastra Agent Skills (ADR 0009) gives discovery, scoping, and validation but **not** the two
properties MichaelOS most needs from a skill platform: a permission model tied to our
**authority/clearance** system, and a **lifecycle** that lets judgment (skills) iterate fast without
abandoning safety. This ADR records both. **Permission model:** a skill is a judgment SOP whose only
real-world effect is the **tools/workflows it invokes**; we therefore make a skill declare its
`allowed-tools` / `allowed-workflows` and its `scope` (`shared` or `[agent-id, …]`) inside the
frontmatter's arbitrary `metadata` map (spec-compliant), with **frontmatter `scope` as the single
source of truth** projected onto Mastra by `skillRegistry` (shared → `workspace.skills`; agent-scoped
→ that agent's `Agent.skills`), and `agentRegistry.ts` demoted to a *derived, validated view*. The
**core safety invariant** is that a skill may only be injected into an agent whose authority covers
**every** tool in its `allowed-tools` — so a skill that calls a `management`-only dangerous tool can
**never** be injected into an `employee` agent (validation fails loudly; the QA Engineer structurally
never receives skill-authoring skills). **Lifecycle:** because a skill is reviewable **English text**
and its danger is delegated to already-gated tools, **skill changes bypass the full QA/promotion
pipeline** that executable code requires, and instead pass a **lighter gate** — (1) **validation**
(Mastra `validateSkillMetadata` + our scope/permission checks: declared tools/workflows exist), (2)
**permission check** (`allowed-tools` ⊆ authority; scope well-formed), and (3) **"it's just text"
reversibility** (committed to git, revertable, with `skill.changed` telemetry). The single
**carve-out** is capability escalation: if a skill change **declares a new dangerous tool/workflow**,
it still surfaces an **operator acknowledgement**, reusing Phase 5's permission-scan + approval-audit
machinery. The **Skill Engineer** (employee) owns this lifecycle (create/edit/validate/eval/
deprecate/archive) and requests genuinely new deterministic tools from the Engineering Lead via a
**tracked Issue/backlog handoff** (not in-process upward delegation); adding the Skill Engineer agent
itself *is* code and goes through the normal QA pipeline — only the skill edits it later makes ride
the lighter gate. The trade-off is that skills are not gate-verified like code; we accept this
because skills carry no executable authority of their own, the permission invariant + dangerous-tool
carve-out contain the only real risk, and reverting a markdown file is trivial — which is precisely
the reversibility the house rules ask for.

Considered alternatives: **route skill changes through the full Phase 5 QA pipeline** (CI + code
review + security + permission + promotion) — rejected; it is heavy ceremony for reviewable text,
kills the fast iteration that makes skills valuable, and adds nothing once the danger (tools) is
already gated. **No permission model — any skill usable by any agent** — rejected; it breaks
separation of duties (e.g. the QA Engineer could acquire authoring or dangerous-tool reach) and the
authority/clearance guarantees from Phase 4/5. **Declare scope/permissions in `agentRegistry.ts`
instead of the skill** — rejected as the source of truth; the skill should own its own audience and
permissions (one place to review), with `agentRegistry` validated against it. **Enforce permissions
only at runtime (let the model try and fail)** — rejected; we enforce at **validation and injection**
time so an over-privileged skill is never even offered to an agent, making the boundary structural
rather than probabilistic. **Skip the dangerous-tool carve-out** (treat all skill edits identically)
— rejected; capability escalation is exactly the case that must stay operator-visible, consistent
with the "dangerous capabilities require approval" rule.
