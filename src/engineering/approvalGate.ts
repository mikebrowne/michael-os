export const DANGEROUS_TOOL_IDS = new Set(["run-build", "ship-docs", "ship-implementation"]);

export function isDangerousTool(toolId: string): boolean {
  return DANGEROUS_TOOL_IDS.has(toolId);
}

export type ApprovalState = {
  granted: Set<string>;
  pending?: string;
};

export function createApprovalState(): ApprovalState {
  return { granted: new Set() };
}

export function requestApproval(state: ApprovalState, toolId: string): void {
  if (!isDangerousTool(toolId)) {
    throw new Error(`Tool is not dangerous: ${toolId}`);
  }
  state.pending = toolId;
}

export function grantApproval(state: ApprovalState, toolId?: string): boolean {
  const id = toolId ?? state.pending;
  if (!id) return false;
  if (!isDangerousTool(id)) return false;
  state.granted.add(id);
  state.pending = undefined;
  return true;
}

export function consumeApproval(state: ApprovalState, toolId: string): boolean {
  if (!state.granted.has(toolId)) {
    return false;
  }
  state.granted.delete(toolId);
  return true;
}

export function needsApprovalMessage(toolId: string): string {
  return `The "${toolId}" action requires your approval. Reply YES to proceed or NO to cancel.`;
}

export function parseYesNo(input: string): "yes" | "no" | null {
  const normalized = input.trim().toLowerCase();
  if (["yes", "y", "approve", "ok", "proceed"].includes(normalized)) return "yes";
  if (["no", "n", "cancel", "stop"].includes(normalized)) return "no";
  return null;
}
