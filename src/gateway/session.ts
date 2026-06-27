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
} from "../engineering/approvalGate.js";
import { getWorkItemByIssue } from "../engineering/workItem.js";
import { createEngineeringTools } from "../mastra/tools/engineering/index.js";
import type { AppConfig } from "../config/loadConfig.js";

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

  if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
    return { output: ["Gateway closed."], exit: true };
  }

  const yesNo = parseYesNo(trimmed);
  if (yesNo && runtime.ctx.approval.pending) {
    if (yesNo === "yes") {
      const toolId = runtime.ctx.approval.pending.toolId;
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
    runtime.ctx.approval.pending = undefined;
    runtime.ctx.telemetry.logShipDecision(false, "cancelled");
    output.push("\nengineering-lead> Cancelled.\n");
    return { output };
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
