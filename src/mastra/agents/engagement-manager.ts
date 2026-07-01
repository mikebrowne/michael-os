import type { Agent } from "@mastra/core/agent";
import { Agent as MastraAgent } from "@mastra/core/agent";
import { createAgentMemory } from "../agentMemory.js";
import type { EngineeringSessionContext } from "../../engineering/sessionContext.js";
import { resolveSkillsForAgent } from "../../skills/skillRegistry.js";
import { createSkillActivationHooks } from "../../skills/skillActivationHooks.js";
import { createSkillTelemetry } from "../../skills/skillTelemetry.js";
import { createEngagementTriageTools } from "../../engagement/engagementTriageTools.js";

const CORE_INSTRUCTIONS = `You are the MichaelOS **Engagement Manager** — the operator's engineering front door.

You are NOT the Engineering Lead. You do not run builds, promote code, or ship to main. You **coordinate**: intake → triage → route.

## Your job

1. **Restate** the operator's need in one sentence.
2. **Triage** build-vs-reuse using tools in order:
   - \`registryScan\` — deterministic registry lookup (cheap, always first)
   - \`comprehendReuse\` — read-only codebase comprehension when registries are inconclusive
   - \`frameworkFirstCheck\` — judgment on Mastra/framework reuse before custom build
3. Load the **author-policy** skill when choosing form (skill vs tool vs workflow vs agent).
4. **Record** a necessity verdict (\`build\`, \`reuse\`, or \`adapt\`) via \`recordNecessityVerdict\`.
5. **Route** to the right specialist via supervisor delegation:
   - **Engineering Lead** — code, tools, workflows, builds, promotion loop
   - **Skill Engineer** — skill authoring, validation, EDD

## Rules

- Employee clearance only — delegate dangerous work to the Engineering Lead.
- Never include secrets or private data.
- Do not duplicate author-policy judgment — invoke that skill.
- Cite sources in the necessity verdict (registry / comprehension / framework-first).
- You are the **engineering-scoped** router — not the org-wide Chief of Staff (Phase 8).`;

export function createEngagementManagerAgent(
  model: string,
  engineeringCtx: EngineeringSessionContext,
  repoRoot: string = process.cwd(),
  engineeringLeadSubAgent?: Agent,
  skillEngineerSubAgent?: Agent,
): MastraAgent {
  const memory = createAgentMemory(repoRoot);
  const skillPaths = resolveSkillsForAgent(repoRoot, "engagement-manager");
  const skillTelemetry = createSkillTelemetry(engineeringCtx.observability);

  const triageTools = createEngagementTriageTools({
    config: engineeringCtx.config,
    observability: engineeringCtx.observability,
    engineeringCtx,
    repoRoot,
  });
  const subAgents: Record<string, Agent> = {};
  if (engineeringLeadSubAgent) subAgents.engineeringLead = engineeringLeadSubAgent;
  if (skillEngineerSubAgent) subAgents.skillEngineer = skillEngineerSubAgent;

  return new MastraAgent({
    id: "engagement-manager",
    name: "Engagement Manager",
    description:
      "Engineering front door: intake, build-vs-reuse triage, necessity verdict, routing.",
    instructions: CORE_INSTRUCTIONS,
    model,
    memory,
    skills: skillPaths,
    skillsFormat: "markdown",
    hooks: createSkillActivationHooks({
      repoRoot,
      agentId: "engagement-manager",
      skillTelemetry,
    }),
    agents: Object.keys(subAgents).length > 0 ? subAgents : undefined,
    tools: {
      registryScan: triageTools.registryScan,
      comprehendReuse: triageTools.comprehendReuse,
      frameworkFirstCheck: triageTools.frameworkFirstCheck,
      recordNecessityVerdict: triageTools.recordNecessityVerdict,
    },
  });
}
