import type { Agent } from "@mastra/core/agent";
import type { Memory } from "@mastra/memory";
import type { EngineeringSessionContext } from "../engineering/sessionContext.js";
import type { GatewayMemorySession } from "../engineering/gatewaySession.js";
import {
  gatewayMemoryOptions,
  refreshGatewayWorkingMemory,
} from "../engineering/gatewaySession.js";
import {
  needsApprovalMessage,
  parseYesNo,
  requestApproval,
  grantSessionApproval,
} from "../engineering/approvalGate.js";
import { logApprovalAudit } from "../engineering/approvalAudit.js";
import { getWorkItemByIssue } from "../engineering/workItem.js";
import { rehydrateBuildFromWorkItem } from "../engineering/buildManifest.js";
import { applyNoRoute, parseNoWithRoute } from "../engineering/noRouting.js";
import {
  formatPromotionDetail,
  formatPromotionListLine,
} from "./promotionFormatting.js";
import { createEngineeringTools } from "../mastra/tools/engineering/index.js";
import type { AppConfig } from "../config/loadConfig.js";
import {
  formatJobDetail,
  formatJobListLine,
} from "./jobFormatting.js";
import {
  isBuildInFlight,
  interruptSteerableBuild,
} from "../agentBuild/steerableBuild.js";
import {
  formatBuildDetail,
  formatBuildListLine,
  listLocalBuildSessions,
  listCursorAgents,
} from "../agentBuild/buildVisibility.js";
import { createRunLogger } from "../logging/runLogger.js";
import type { GatewayRouteState } from "./gatewayRouteRegistry.js";
import {
  formatDirectChatAgentsList,
  getThreadIdForRoute,
  parseAgentSwitchCommand,
  saveGatewayRouteState,
  switchActiveRoute,
} from "./gatewayRouteRegistry.js";
import {
  formatNecessityVerdictSummary,
  readNecessityVerdict,
} from "../engagement/necessityVerdict.js";

export type GatewayAgents = Record<string, Agent>;

export type GatewayRuntime = {
  agents: GatewayAgents;
  routeState: GatewayRouteState;
  ctx: EngineeringSessionContext;
  memory: Memory;
  tools: ReturnType<typeof createEngineeringTools>;
  config: AppConfig;
  repoPath: string;
  persistRoutes: boolean;
};

function activeAgentId(runtime: GatewayRuntime): string {
  return runtime.routeState.activeAgentId;
}

function activeAgent(runtime: GatewayRuntime): Agent {
  const id = activeAgentId(runtime);
  const agent = runtime.agents[id];
  if (!agent) {
    throw new Error(`No gateway agent registered for route "${id}".`);
  }
  return agent;
}

function agentPrefix(runtime: GatewayRuntime): string {
  return `${activeAgentId(runtime)}>`;
}

function memorySessionForRoute(runtime: GatewayRouteState): GatewayMemorySession {
  const threadId = getThreadIdForRoute(runtime, runtime.activeAgentId);
  return { threadId, resourceId: runtime.resourceId };
}

function persistRoutesIfNeeded(runtime: GatewayRuntime): void {
  if (runtime.persistRoutes) {
    saveGatewayRouteState(runtime.repoPath, runtime.routeState);
  }
}

async function agentGenerate(
  runtime: GatewayRuntime,
  message: string,
): Promise<string> {
  const memorySession = memorySessionForRoute(runtime.routeState);
  const response = await activeAgent(runtime).generate(
    message,
    gatewayMemoryOptions(memorySession),
  );
  return response.text ?? "(no response)";
}

function formatAgentOutput(runtime: GatewayRuntime, text: string): string {
  return `\n${agentPrefix(runtime)} ${text}\n`;
}

export type GatewayTurnResult = {
  output: string[];
  exit?: boolean;
};

export async function processGatewayLine(
  runtime: GatewayRuntime,
  line: string,
): Promise<GatewayTurnResult> {
  const trimmed = line.trim();
  const output: string[] = [];

  if (!trimmed) {
    return { output };
  }

  const switchAgentId = parseAgentSwitchCommand(trimmed);
  if (switchAgentId) {
    const result = switchActiveRoute(
      runtime.routeState,
      switchAgentId,
      runtime.repoPath,
    );
    if (!result.ok) {
      output.push(`\n${result.message}\n`);
      return { output };
    }
    persistRoutesIfNeeded(runtime);
    const memorySession = memorySessionForRoute(runtime.routeState);
    await refreshGatewayWorkingMemory(
      runtime.memory,
      memorySession,
      runtime.ctx.currentWorkItem,
    );
    output.push(
      `\nSwitched from @${result.previousAgentId} to @${switchAgentId} (thread ${memorySession.threadId.slice(0, 8)}…).\n`,
    );
    return { output };
  }

  if (trimmed.toLowerCase() === "agents") {
    output.push(`\n${formatDirectChatAgentsList(runtime.repoPath)}\n`);
    output.push(`Active route: @${activeAgentId(runtime)}\n`);
    return { output };
  }

  if (trimmed.toLowerCase() === "verdict") {
    const slug = runtime.ctx.currentWorkItem?.slug;
    if (!slug) {
      output.push("\nNo current work item — use resume #N first.\n");
      return { output };
    }
    const verdict = readNecessityVerdict(runtime.config.stateDir, slug);
    if (!verdict) {
      output.push(`\nNo necessity verdict recorded for "${slug}".\n`);
      return { output };
    }
    output.push(`\n${formatNecessityVerdictSummary(verdict)}\n`);
    return { output };
  }

  const interruptCommands = ["stop", "cancel"];
  if (interruptCommands.includes(trimmed.toLowerCase())) {
    const slug = runtime.ctx.currentWorkItem?.slug;
    if (slug && isBuildInFlight(slug)) {
      const runLogger = createRunLogger({
        logDir: runtime.config.logDir,
        logLevel: runtime.config.logLevel,
        name: runtime.config.appName,
      });
      const result = await interruptSteerableBuild({
        config: runtime.config,
        slug,
        observability: runtime.ctx.observability,
        runLogger,
      });
      output.push(formatAgentOutput(runtime, result.message));
      return { output };
    }
  }

  if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
    return { output: ["Gateway closed."], exit: true };
  }

  const yesNo = parseYesNo(trimmed);
  const noWithRoute = parseNoWithRoute(trimmed);
  if ((yesNo || noWithRoute) && runtime.ctx.approval.pending) {
    if (yesNo === "yes") {
      const toolId = runtime.ctx.approval.pending.toolId;
      const pendingArgs = runtime.ctx.approval.pending.args;
      logApprovalAudit(runtime.ctx.observability, runtime.ctx.telemetry, {
        toolId,
        approved: true,
        workItemSlug: runtime.ctx.currentWorkItem?.slug,
        issueNumber: runtime.ctx.currentWorkItem?.issueNumber,
        args: pendingArgs,
      });
      try {
        const result = await runtime.tools.replayDangerousTool();
        output.push(formatAgentOutput(runtime, `Approved ${toolId}. Result:`));
        output.push(JSON.stringify(result, null, 2));
      } catch (error: unknown) {
        output.push(
          formatAgentOutput(
            runtime,
            `Error replaying ${toolId}: ${error instanceof Error ? error.message : error}`,
          ),
        );
      }
      await refreshGatewayWorkingMemory(
        runtime.memory,
        memorySessionForRoute(runtime.routeState),
        runtime.ctx.currentWorkItem,
      );
      return { output };
    }
    if (noWithRoute || yesNo === "no") {
      const deniedToolId = runtime.ctx.approval.pending.toolId;
      const deniedArgs = runtime.ctx.approval.pending.args;
      const route = noWithRoute?.route ?? "fix";

      logApprovalAudit(runtime.ctx.observability, runtime.ctx.telemetry, {
        toolId: deniedToolId,
        approved: false,
        workItemSlug: runtime.ctx.currentWorkItem?.slug,
        issueNumber: runtime.ctx.currentWorkItem?.issueNumber,
        args: { ...deniedArgs, noRoute: route },
      });
      runtime.ctx.approval.pending = undefined;
      runtime.ctx.telemetry.logApprovalDecision(false, deniedToolId);

      if (deniedToolId === "promote" && runtime.ctx.currentWorkItem) {
        const routed = await applyNoRoute({
          route,
          workItem: runtime.ctx.currentWorkItem,
          stateDir: runtime.config.stateDir,
          githubRepo: runtime.ctx.githubRepo,
          ghRunner: runtime.ctx.ghRunner,
        });
        runtime.ctx.currentWorkItem = routed.workItem;
        output.push(formatAgentOutput(runtime, routed.message));
      } else {
        output.push(formatAgentOutput(runtime, "Cancelled."));
      }
      await refreshGatewayWorkingMemory(
        runtime.memory,
        memorySessionForRoute(runtime.routeState),
        runtime.ctx.currentWorkItem,
      );
      return { output };
    }
  }

  if (trimmed.toLowerCase() === "list") {
    const text = await agentGenerate(
      runtime,
      "Use list-in-progress and summarize open work items for the operator.",
    );
    if (runtime.ctx.approval.pending) {
      output.push(
        formatAgentOutput(
          runtime,
          needsApprovalMessage(runtime.ctx.approval.pending.toolId),
        ),
      );
    }
    output.push(formatAgentOutput(runtime, text));
    await refreshGatewayWorkingMemory(
      runtime.memory,
      memorySessionForRoute(runtime.routeState),
      runtime.ctx.currentWorkItem,
    );
    return { output };
  }

  const resumeMatch = trimmed.match(/^resume\s+#?(\d+)$/i);
  if (resumeMatch) {
    const issueNumber = Number(resumeMatch[1]);
    const item = getWorkItemByIssue(runtime.config.stateDir, issueNumber);
    if (item) {
      runtime.ctx.currentWorkItem = item;
      const rehydrated = rehydrateBuildFromWorkItem(runtime.ctx.repoPath, item);
      if (rehydrated) {
        runtime.ctx.lastBuildResult = rehydrated;
      }
      await refreshGatewayWorkingMemory(
        runtime.memory,
        memorySessionForRoute(runtime.routeState),
        item,
      );
    }
    const text = await agentGenerate(
      runtime,
      `Resume work for GitHub issue #${issueNumber}. Use resume-work-item and summarize state. Current slug if known: ${item?.slug ?? "look it up"}.`,
    );
    output.push(formatAgentOutput(runtime, text));
    await refreshGatewayWorkingMemory(
      runtime.memory,
      memorySessionForRoute(runtime.routeState),
      runtime.ctx.currentWorkItem,
    );
    return { output };
  }

  if (trimmed.toLowerCase() === "authorize dispatch") {
    const slug = runtime.ctx.currentWorkItem?.slug;
    if (!slug) {
      output.push("\nNo current work item to authorize dispatch for.\n");
      return { output };
    }
    grantSessionApproval(runtime.ctx.approval, "dispatch-slice", slug);
    output.push(
      formatAgentOutput(
        runtime,
        `Pre-authorized dispatch-slice for build "${slug}" until finish/cancel.`,
      ),
    );
    return { output };
  }

  if (trimmed.toLowerCase() === "builds") {
    const sessions = listLocalBuildSessions(runtime.config.stateDir);
    if (sessions.length === 0) {
      output.push("\nNo durable build sessions recorded.\n");
    } else {
      output.push("\nDurable build sessions:\n");
      for (const session of sessions.slice(0, 20)) {
        output.push(`${formatBuildListLine(session)}\n`);
      }
    }
    const agents = await listCursorAgents(runtime.config, runtime.ctx.repoPath);
    output.push("\nCursor local agents:\n");
    for (const line of agents) {
      output.push(`${line}\n`);
    }
    return { output };
  }

  const buildMatch = trimmed.match(/^build\s+(\S+)$/i);
  if (buildMatch) {
    const query = buildMatch[1]!;
    output.push(`\n${formatBuildDetail(runtime.config, query)}\n`);
    return { output };
  }

  if (trimmed.toLowerCase() === "health") {
    output.push("ok");
    return { output };
  }

  if (trimmed.toLowerCase() === "jobs") {
    const jobs = await runtime.ctx.jobRegistry.listJobs({ limit: 20 });
    if (jobs.length === 0) {
      output.push("\nNo jobs found.\n");
      return { output };
    }
    output.push("\nRecent jobs:\n");
    for (const job of jobs) {
      output.push(`${formatJobListLine(job)}\n`);
    }
    return { output };
  }

  const jobMatch = trimmed.match(/^job\s+#?([0-9a-f-]+)$/i);
  if (jobMatch) {
    const query = jobMatch[1]!;
    const jobs = await runtime.ctx.jobRegistry.listJobs({ limit: 100 });
    const job = jobs.find(
      (j) => j.id === query || j.id.startsWith(query),
    );
    if (!job) {
      output.push(`\nNo job matching "${query}".\n`);
      return { output };
    }
    output.push(`\n${formatJobDetail(job)}\n`);
    return { output };
  }

  if (trimmed.toLowerCase() === "promotions") {
    const promotions = await runtime.ctx.promotionRegistry.listPromotions({
      limit: 20,
    });
    if (promotions.length === 0) {
      output.push("\nNo promotions recorded.\n");
      return { output };
    }
    output.push("\nPromotions:\n");
    for (const record of promotions) {
      output.push(`${formatPromotionListLine(record)}\n`);
    }
    return { output };
  }

  const promotionMatch = trimmed.match(/^promotion\s+#?(\d+)$/i);
  if (promotionMatch) {
    const promotionNumber = Number(promotionMatch[1]);
    const record = await runtime.ctx.promotionRegistry.getPromotionByNumber(
      promotionNumber,
    );
    if (!record) {
      output.push(`\nNo promotion #${promotionNumber}.\n`);
      return { output };
    }
    output.push(`\n${formatPromotionDetail(record)}\n`);
    return { output };
  }

  const rollbackMatch = trimmed.match(/^rollback\s+#?(\d+)$/i);
  if (rollbackMatch) {
    const promotionNumber = Number(rollbackMatch[1]);
    const record = await runtime.ctx.promotionRegistry.getPromotionByNumber(
      promotionNumber,
    );
    if (!record) {
      output.push(`\nNo promotion #${promotionNumber} to roll back.\n`);
      return { output };
    }
    if (record.status === "rolled-back") {
      output.push(`\nPromotion #${promotionNumber} is already rolled back.\n`);
      return { output };
    }
    requestApproval(runtime.ctx.approval, "rollback", { promotionNumber });
    output.push(formatAgentOutput(runtime, needsApprovalMessage("rollback")));
    return { output };
  }

  if (trimmed.toLowerCase() === "restart") {
    requestApproval(runtime.ctx.approval, "restart", {});
    output.push(formatAgentOutput(runtime, needsApprovalMessage("restart")));
    return { output };
  }

  try {
    const text = await agentGenerate(runtime, trimmed);
    if (runtime.ctx.approval.pending) {
      output.push(
        formatAgentOutput(
          runtime,
          needsApprovalMessage(runtime.ctx.approval.pending.toolId),
        ),
      );
    }
    output.push(formatAgentOutput(runtime, text));
    await refreshGatewayWorkingMemory(
      runtime.memory,
      memorySessionForRoute(runtime.routeState),
      runtime.ctx.currentWorkItem,
    );
    persistRoutesIfNeeded(runtime);
  } catch (error: unknown) {
    output.push(
      formatAgentOutput(
        runtime,
        `Error: ${error instanceof Error ? error.message : error}`,
      ),
    );
  }

  return { output };
}

export async function createGatewayRuntime(options: {
  config: AppConfig;
  ctx: EngineeringSessionContext;
  agents: GatewayAgents;
  routeState: GatewayRouteState;
  memory: Memory;
  repoPath: string;
  persistRoutes?: boolean;
}): Promise<GatewayRuntime> {
  const tools = createEngineeringTools(options.ctx);
  return {
    agents: options.agents,
    routeState: options.routeState,
    ctx: options.ctx,
    memory: options.memory,
    tools,
    config: options.config,
    repoPath: options.repoPath,
    persistRoutes: options.persistRoutes ?? false,
  };
}

export function gatewayPromptLabel(runtime: GatewayRuntime): string {
  return agentPrefix(runtime);
}
