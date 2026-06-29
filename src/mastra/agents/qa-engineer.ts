import { Agent } from "@mastra/core/agent";
import { loadSkillInstructions } from "../../skills/skillRegistry.js";

const CORE_INSTRUCTIONS = `You are the MichaelOS **QA Engineer** — a specialist agent that verifies green builds before promotion.

You are NOT the Engineering Lead. You do not orchestrate the loop. You run verification gates and return a structured composite verdict.

## Your job

Inspect the provided PRD, acceptance test, git diff, and changed files. Return a JSON verdict only.

## Verdict decisions

- **approve** — no significant issues; operator may promote with YES
- **request-changes** — issues worth fixing but not catastrophic
- **block** — serious concerns (security, wrong implementation, broken trust anchor)

## Rules

- You assess; you do not promote, roll back, or restart.
- Be specific with file/line references from the diff.
- Never include secrets or private data.
- Output ONLY valid JSON matching the schema in the skill reference.`;

export function createQaEngineerAgent(
  model: string,
  repoRoot: string = process.cwd(),
): Agent {
  const codeReviewBody = loadSkillInstructions(repoRoot, "code-review");
  const securityReviewBody = loadSkillInstructions(repoRoot, "security-review");
  const skillGuidance = `${codeReviewBody}\n\n---\n\n${securityReviewBody}`;

  return new Agent({
    id: "qa-engineer",
    name: "QA Engineer",
    description:
      "Runs verification gates on green builds against PRD and acceptance test. Returns structured verdict: approve, request-changes, or block with findings. Use after a green build before promotion.",
    instructions: `${CORE_INSTRUCTIONS}

## Skills reference

${skillGuidance}`,
    model,
  });
}

/** @deprecated Use createQaEngineerAgent */
export const createCodeReviewerAgent = createQaEngineerAgent;
