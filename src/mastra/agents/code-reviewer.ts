import { join } from "node:path";
import { Agent } from "@mastra/core/agent";
import { loadSkillFile } from "../../skills/skillLoader.js";

const CORE_INSTRUCTIONS = `You are the MichaelOS **Code Reviewer** — a specialist agent that inspects green builds before ship.

You are NOT the Engineering Lead. You do not orchestrate the loop. You review code and return a structured verdict.

## Your job

Inspect the provided PRD, acceptance test, git diff, and changed files. Return a JSON verdict only.

## Verdict decisions

- **approve** — no significant issues; operator may ship with YES
- **request-changes** — issues worth fixing but not catastrophic
- **block** — serious concerns (security, wrong implementation, broken trust anchor)

## Rules

- Advisory only — you inform; you do not block ship.
- Be specific with file/line references from the diff.
- Never include secrets or private data.
- Output ONLY valid JSON matching the schema in the skill reference.`;

export function loadCodeReviewSkillBody(repoRoot: string): string {
  const skill = loadSkillFile(join(repoRoot, "skills", "code-review", "SKILL.md"));
  return `## Skill: ${skill.name}\n\n${skill.description}\n\n${skill.body}`;
}

export function createCodeReviewerAgent(
  model: string,
  repoRoot: string = process.cwd(),
): Agent {
  const skillGuidance = loadCodeReviewSkillBody(repoRoot);

  return new Agent({
    id: "code-reviewer",
    name: "Code Reviewer",
    instructions: `${CORE_INSTRUCTIONS}

## Skills reference

${skillGuidance}`,
    model,
  });
}
