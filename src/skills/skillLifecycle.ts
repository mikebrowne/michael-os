import { DANGEROUS_TOOL_IDS, isDangerousTool } from "../engineering/approvalGate.js";

export function detectNewDangerousAllowedTools(
  previous: string[],
  next: string[],
): string[] {
  const prevSet = new Set(previous);
  return next.filter((toolId) => !prevSet.has(toolId) && isDangerousTool(toolId));
}

export function detectNewDangerousWorkflows(
  previous: string[],
  next: string[],
): string[] {
  const prevSet = new Set(previous);
  return next.filter((toolId) => !prevSet.has(toolId));
}

export function skillChangeApprovalKey(skillName: string): string {
  return `skill-change:${skillName}`;
}

export function skillDeclaresDangerousTools(tools: string[]): string[] {
  return tools.filter((t) => DANGEROUS_TOOL_IDS.has(t));
}
