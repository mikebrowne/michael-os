import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { listAgents } from "../mastra/agentRegistry.js";
import { createGatewayMemorySession } from "../engineering/gatewaySession.js";

export type GatewayRouteState = {
  activeAgentId: string;
  threads: Record<string, string>;
  resourceId: "operator";
};

const ROUTES_STATE_FILE = join(".mastra", "gateway-routes.json");

export function listDirectChatAgentIds(repoRoot: string = process.cwd()): string[] {
  return listAgents(repoRoot)
    .filter((a) => a.directChat)
    .map((a) => a.id);
}

export function resolveDefaultGatewayAgentId(repoRoot: string = process.cwd()): string {
  const env = process.env.GATEWAY_DEFAULT_AGENT?.trim();
  const directChatIds = listDirectChatAgentIds(repoRoot);
  if (env && directChatIds.includes(env)) {
    return env;
  }
  if (directChatIds.includes("engagement-manager")) {
    return "engagement-manager";
  }
  if (directChatIds.includes("engineering-lead")) {
    return "engineering-lead";
  }
  return directChatIds[0] ?? "engineering-lead";
}

export function createGatewayRouteState(
  defaultAgentId: string,
): GatewayRouteState {
  const threadId = createGatewayMemorySession().threadId;
  return {
    activeAgentId: defaultAgentId,
    threads: { [defaultAgentId]: threadId },
    resourceId: "operator",
  };
}

export function loadGatewayRouteState(
  repoRoot: string,
  defaultAgentId?: string,
): GatewayRouteState {
  const activeDefault = defaultAgentId ?? resolveDefaultGatewayAgentId(repoRoot);
  const statePath = join(repoRoot, ROUTES_STATE_FILE);
  mkdirSync(join(repoRoot, ".mastra"), { recursive: true });

  if (existsSync(statePath)) {
    const parsed = JSON.parse(readFileSync(statePath, "utf-8")) as Partial<GatewayRouteState>;
    const threads = parsed.threads ?? {};
    const activeAgentId =
      parsed.activeAgentId && listDirectChatAgentIds(repoRoot).includes(parsed.activeAgentId)
        ? parsed.activeAgentId
        : activeDefault;
    if (!threads[activeAgentId]) {
      threads[activeAgentId] = createGatewayMemorySession().threadId;
    }
    return {
      activeAgentId,
      threads,
      resourceId: "operator",
    };
  }

  return createGatewayRouteState(activeDefault);
}

export function saveGatewayRouteState(
  repoRoot: string,
  state: GatewayRouteState,
): void {
  const statePath = join(repoRoot, ROUTES_STATE_FILE);
  mkdirSync(join(repoRoot, ".mastra"), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}

export function getThreadIdForRoute(
  state: GatewayRouteState,
  agentId: string,
): string {
  const existing = state.threads[agentId];
  if (existing) return existing;
  const threadId = randomUUID();
  state.threads[agentId] = threadId;
  return threadId;
}

export function switchActiveRoute(
  state: GatewayRouteState,
  agentId: string,
  repoRoot: string = process.cwd(),
): { ok: true; previousAgentId: string } | { ok: false; message: string } {
  const allowed = listDirectChatAgentIds(repoRoot);
  if (!allowed.includes(agentId)) {
    return {
      ok: false,
      message: `Unknown or non-direct-chat agent "${agentId}". Use 'agents' to list available routes.`,
    };
  }
  const previousAgentId = state.activeAgentId;
  state.activeAgentId = agentId;
  getThreadIdForRoute(state, agentId);
  return { ok: true, previousAgentId };
}

export function parseAgentSwitchCommand(line: string): string | undefined {
  const match = line.trim().match(/^@([a-z0-9-]+)$/i);
  return match?.[1]?.toLowerCase();
}

export function formatDirectChatAgentsList(repoRoot: string = process.cwd()): string {
  const agents = listAgents(repoRoot).filter((a) => a.directChat);
  if (agents.length === 0) {
    return "No direct-chat agents registered.";
  }
  const lines = ["Direct-chat agents (use @<id> to switch):"];
  for (const agent of agents) {
    lines.push(`- @${agent.id} — ${agent.role}: ${agent.description}`);
  }
  return lines.join("\n");
}
