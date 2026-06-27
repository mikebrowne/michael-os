import { join } from "node:path";
import { Agent } from "@mastra/core/agent";
import { loadSkillFile } from "../../skills/skillLoader.js";
import { createEngineeringTools } from "../tools/engineering/index.js";
import type { EngineeringSessionContext } from "../../engineering/sessionContext.js";

const SKILL_NAMES = [
  "grill-me-with-docs",
  "to-prd",
  "research-write-tests",
  "build-handoff",
] as const;

export function loadEngineeringSkillBodies(repoRoot: string): string {
  return SKILL_NAMES.map((name) => {
    const skill = loadSkillFile(join(repoRoot, "skills", name, "SKILL.md"));
    return `## Skill: ${skill.name}\n\n${skill.description}\n\n${skill.body}`;
  }).join("\n\n---\n\n");
}

export function createEngineeringLeadAgent(
  model: string,
  ctx: EngineeringSessionContext,
  repoRoot: string = process.cwd(),
): Agent {
  const tools = createEngineeringTools(ctx);
  const skillGuidance = loadEngineeringSkillBodies(repoRoot);

  return new Agent({
    id: "engineering-lead",
    name: "Engineering Lead",
    instructions: `You are the MichaelOS Engineering Lead — the operator's first production agent.

You drive the engineering loop conversationally: grill → PRD → tests → build → report → ship.

## Operating rules

- Use tools for all side effects (saving docs, GitHub issues, builds, ship).
- Ask the operator before expensive steps (tests, build, ship).
- Dangerous tools (run-build, ship-docs, ship-implementation) require operator YES — if a tool returns needsApproval, tell the operator to reply YES or NO.
- Never invent build status — only report what tools return.
- Planning docs ship separately from implementation (ship-docs vs ship-implementation).
- Keep scope thin — one vertical slice per work item.
- Never include secrets, API keys, or private data.

## Skills reference

${skillGuidance}

## Resume

Use resume-work-item with slug or issue number, or list-in-progress when the operator asks what's in flight.`,
    model,
    tools: {
      saveGrillNotes: tools.saveGrillNotes,
      savePrd: tools.savePrd,
      saveTestArtifacts: tools.saveTestArtifacts,
      githubCreateIssue: tools.githubCreateIssue,
      githubUpdateIssue: tools.githubUpdateIssue,
      listInProgress: tools.listInProgress,
      resumeWorkItem: tools.resumeWorkItem,
      runBuild: tools.runBuild,
      shipDocs: tools.shipDocsTool,
      shipImplementation: tools.shipImplementationTool,
    },
  });
}
