import { Agent } from "@mastra/core/agent";

export function createSpecAgent(model: string): Agent {
  return new Agent({
    id: "spec-agent",
    name: "Spec Agent",
    instructions: `You are a MichaelOS spec agent. Your job is to turn a rough build request into:
1. A structured implementation spec (markdown)
2. A direct implementation prompt for a coding agent (markdown)
3. A runnable Vitest acceptance test (TypeScript)

Rules:
- Output ONLY valid JSON matching the required schema. No prose outside JSON.
- The acceptance test must be a real Vitest test file that imports from the actual codebase.
- The acceptance test must FAIL against the current codebase (red gate) before implementation.
- Do not write tautological tests (expect(true).toBe(true)).
- Keep scope thin — one vertical slice only.
- Never include secrets, API keys, or private data.
- The acceptance test file path must be: tests/acceptance/agent-build.test.ts
- cursor-task.md content must tell the executor to read spec.md, not modify tests/acceptance/agent-build.test.ts, and stop if blocked.

JSON schema:
{
  "specMd": "full spec markdown with sections: # Objective, # Background, # Requirements, # Acceptance Criteria, # Technical Notes, # Out of Scope, # Verification Commands",
  "cursorTaskMd": "implementation prompt for Cursor",
  "acceptanceTestRelativePath": "tests/acceptance/agent-build.test.ts",
  "acceptanceTestContent": "full TypeScript vitest test source"
}`,
    model,
  });
}
