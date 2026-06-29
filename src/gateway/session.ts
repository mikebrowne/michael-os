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
import { createRunLogger } from "../logging/runLogger.js";

export type GatewayRuntime = {
  agent: Agent;
  ctx: EngineeringSessionContext;
  memory: Memory;
  memorySession: GatewayMemorySession;
  tools: ReturnType<typeof createEngineeringTools>;
  config: AppConfig;
};

async function agentGenerate(
  runtime: GatewayRuntime,
  message: string,
): Promise<string> {
  const response = await runtime.agent.generate(
    message,
    gatewayMemoryOptions(runtime.memorySession),
  );
  return response.text ?? "(no response)";
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
      output.push(`\nengineering-lead> ${result.message}\n`);
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
        output.push(`\nengineering-lead> Approved ${toolId}. Result:\n`);
        output.push(JSON.stringify(result, null, 2));
      } catch (error: unknown) {
        output.push(
          `\nengineering-lead> Error replaying ${toolId}: ${error instanceof Error ? error.message : error}\n`,
        );
      }
      await refreshGatewayWorkingMemory(
        runtime.memory,
        runtime.memorySession,
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
        output.push(`\nengineering-lead> ${routed.message}\n`);
      } else {
        output.push("\nengineering-lead> Cancelled.\n");
      }
      await refreshGatewayWorkingMemory(
        runtime.memory,
        runtime.memorySession,
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
        `\nengineering-lead> ${needsApprovalMessage(runtime.ctx.approval.pending.toolId)}\n`,
      );
    }
    output.push(`\nengineering-lead> ${text}\n`);
    await refreshGatewayWorkingMemory(
      runtime.memory,
      runtime.memorySession,
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
        runtime.memorySession,
        item,
      );
    }
    const text = await agentGenerate(
      runtime,
      `Resume work for GitHub issue #${issueNumber}. Use resume-work-item and summarize state. Current slug if known: ${item?.slug ?? "look it up"}.`,
    );
    output.push(`\nengineering-lead> ${text}\n`);
    await refreshGatewayWorkingMemory(
      runtime.memory,
      runtime.memorySession,
      runtime.ctx.currentWorkItem,
    );
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
    output.push(`\nengineering-lead> ${needsApprovalMessage("rollback")}\n`);
    return { output };
  }

  if (trimmed.toLowerCase() === "restart") {
    requestApproval(runtime.ctx.approval, "restart", {});
    output.push(`\nengineering-lead> ${needsApprovalMessage("restart")}\n`);
    return { output };
  }

  try {
    const text = await agentGenerate(runtime, trimmed);
    if (runtime.ctx.approval.pending) {
      output.push(
        `\nengineering-lead> ${needsApprovalMessage(runtime.ctx.approval.pending.toolId)}\n`,
      );
    }
    output.push(`\nengineering-lead> ${text}\n`);
    await refreshGatewayWorkingMemory(
      runtime.memory,
      runtime.memorySession,
      runtime.ctx.currentWorkItem,
    );
  } catch (error: unknown) {
    output.push(
      `\nengineering-lead> Error: ${error instanceof Error ? error.message : error}\n`,
    );
  }

  return { output };
}

export async function createGatewayRuntime(options: {
  config: AppConfig;
  ctx: EngineeringSessionContext;
  agent: Agent;
  memory: Memory;
  memorySession: GatewayMemorySession;
}): Promise<GatewayRuntime> {
  const tools = createEngineeringTools(options.ctx);
  return {
    agent: options.agent,
    ctx: options.ctx,
    memory: options.memory,
    memorySession: options.memorySession,
    tools,
    config: options.config,
  };
}
