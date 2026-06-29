export const DANGEROUS_TOOL_IDS = new Set([
  "run-build",
  "ship-docs",
  "ship-implementation",
  "stage-implementation",
  "promote",
  "rollback",
  "restart",
]);

export function isDangerousTool(toolId: string): boolean {
  return DANGEROUS_TOOL_IDS.has(toolId);
}

export type PendingApproval = {
  toolId: string;
  args: Record<string, unknown>;
};

export type ApprovalState = {
  granted: Set<string>;
  pending?: PendingApproval;
};

export function createApprovalState(): ApprovalState {
  return { granted: new Set() };
}

export function requestApproval(
  state: ApprovalState,
  toolId: string,
  args: Record<string, unknown> = {},
): void {
  if (!isDangerousTool(toolId)) {
    throw new Error(`Tool is not dangerous: ${toolId}`);
  }
  state.pending = { toolId, args };
}

export function grantApproval(state: ApprovalState, toolId?: string): boolean {
  const id = toolId ?? state.pending?.toolId;
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

export function grantPendingApproval(state: ApprovalState): boolean {
  const id = state.pending?.toolId;
  if (!id) return false;
  state.granted.add(id);
  state.pending = undefined;
  return true;
}

export function parseYesNo(input: string): "yes" | "no" | null {
  const normalized = input.trim().toLowerCase();
  if (["yes", "y", "approve", "ok", "proceed"].includes(normalized)) return "yes";
  if (["no", "n", "cancel", "stop"].includes(normalized)) return "no";
  return null;
}
