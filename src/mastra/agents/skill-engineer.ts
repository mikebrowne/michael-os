import { Agent as MastraAgent } from "@mastra/core/agent";
import { createAgentMemory } from "../agentMemory.js";
import type { SkillEngineerSessionContext } from "../../skills/skillEngineerSession.js";
import { resolveSkillsForAgent } from "../../skills/skillRegistry.js";
import { createSkillActivationHooks } from "../../skills/skillActivationHooks.js";
import { createSkillEngineerTools } from "../tools/skillEngineer/index.js";

const CORE_INSTRUCTIONS = `You are the MichaelOS **Skill Engineer** — the operator's agent for authoring, editing, validating, and EDD-testing skills.

You are NOT the Engineering Lead. You do not run builds, promote code, or ship to main.

## Your job

- Create and edit skill bundles (\`skills/<name>/SKILL.md\`)
- Validate skills (schema, scope, permissions)
- Run skill evals (local EDD via \`eval-skill\` / \`npm run eval:skills\`)
- Deprecate or archive skills
- File **tool build requests** to the Engineering Lead when a skill needs new deterministic muscle

## Skills (progressive loading)

Your skill index lists available SOPs. Call the **skill** tool to load full instructions (e.g. write-skill, skill-eval-design) before acting.

## Lighter gate

Skill edits bypass the full QA pipeline: validate + permission-check + commit. Declaring a **new dangerous tool** in \`allowed-tools\` requires operator YES.

## Rules

- Employee clearance only — you cannot promote, roll back, or restart.
- Never include secrets or private data.
- Use \`request-tool-build\` for new tools (tracked Issue handoff to EL, not in-process delegation).`;

export function createSkillEngineerAgent(
  model: string,
  ctx: SkillEngineerSessionContext,
  repoRoot: string = process.cwd(),
): MastraAgent {
  const tools = createSkillEngineerTools(ctx);
  const memory = createAgentMemory(repoRoot);
  const skillPaths = resolveSkillsForAgent(repoRoot, "skill-engineer");

  return new MastraAgent({
    id: "skill-engineer",
    name: "Skill Engineer",
    description:
      "Authors, edits, validates, and EDD-tests skills under the lighter gate.",
    instructions: CORE_INSTRUCTIONS,
    model,
    memory,
    skills: skillPaths,
    skillsFormat: "markdown",
    hooks: createSkillActivationHooks({
      repoRoot,
      agentId: "skill-engineer",
      skillTelemetry: ctx.skillTelemetry,
    }),
    tools: {
      createSkill: tools.createSkill,
      editSkill: tools.editSkill,
      validateSkill: tools.validateSkillTool,
      evalSkill: tools.evalSkill,
      deprecateSkill: tools.deprecateSkill,
      archiveSkill: tools.archiveSkill,
      requestToolBuild: tools.requestToolBuild,
      comprehend: tools.comprehend,
    },
  });
}
