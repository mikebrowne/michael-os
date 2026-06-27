import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import { createAgentMemory } from "../src/mastra/agentMemory.js";
import {
  grantApproval,
  parseYesNo,
  needsApprovalMessage,
} from "../src/engineering/approvalGate.js";
import {
  ensurePrdsDir,
  getWorkItemByIssue,
} from "../src/engineering/workItem.js";
import {
  bootstrapGatewayWorkingMemory,
  createGatewayMemorySession,
  gatewayMemoryOptions,
  refreshGatewayWorkingMemory,
} from "../src/engineering/gatewaySession.js";
import type { Agent } from "@mastra/core/agent";
import type { GatewayMemorySession } from "../src/engineering/gatewaySession.js";
import type { EngineeringSessionContext } from "../src/engineering/sessionContext.js";

type GatewayRuntime = {
  agent: Agent;
  ctx: EngineeringSessionContext;
  memorySession: GatewayMemorySession;
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

async function handleAgentTurn(
  runtime: GatewayRuntime,
  message: string,
): Promise<void> {
  const text = await agentGenerate(runtime, message);

  if (text.includes("needsApproval") || runtime.ctx.approval.pending) {
    if (runtime.ctx.approval.pending) {
      console.log(
        `\nengineering-lead> ${needsApprovalMessage(runtime.ctx.approval.pending)}\n`,
      );
    }
  }

  console.log(`\nengineering-lead> ${text}\n`);
}

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = createEngineeringSessionContext(config);
  const agent = createEngineeringLeadAgent(config.defaultModel, ctx);
  const memory = createAgentMemory();
  const memorySession = createGatewayMemorySession();

  await bootstrapGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);

  const runtime: GatewayRuntime = { agent, ctx, memorySession };

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Engineering Gateway");
  console.log("Chat with the Engineering Lead. Commands: exit | resume #N | list");
  console.log("Dangerous actions require YES when prompted.");
  console.log(`Session thread: ${memorySession.threadId.slice(0, 8)}… (memory on)\n`);

  while (true) {
    const line = await rl.question("you> ");
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (["exit", "quit", "q"].includes(trimmed.toLowerCase())) {
      break;
    }

    const yesNo = parseYesNo(trimmed);
    if (yesNo && ctx.approval.pending) {
      if (yesNo === "yes") {
        const toolId = ctx.approval.pending;
        grantApproval(ctx.approval, toolId);
        console.log(`\nengineering-lead> Approved ${toolId}. Retrying...\n`);
        const text = await agentGenerate(
          runtime,
          `Operator approved ${toolId}. You MUST call the ${toolId} tool now with the same arguments as before. Do not ask questions.`,
        );
        console.log(`\nengineering-lead> ${text}\n`);
        await refreshGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);
        continue;
      }
      ctx.approval.pending = undefined;
      console.log("\nengineering-lead> Cancelled.\n");
      continue;
    }

    if (trimmed.toLowerCase() === "list") {
      await handleAgentTurn(
        runtime,
        "Use list-in-progress and summarize open work items for the operator.",
      );
      await refreshGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);
      continue;
    }

    const resumeMatch = trimmed.match(/^resume\s+#?(\d+)$/i);
    if (resumeMatch) {
      const issueNumber = Number(resumeMatch[1]);
      const item = getWorkItemByIssue(config.stateDir, issueNumber);
      if (item) {
        ctx.currentWorkItem = item;
        await refreshGatewayWorkingMemory(memory, memorySession, item);
      }
      await handleAgentTurn(
        runtime,
        `Resume work for GitHub issue #${issueNumber}. Use resume-work-item and summarize state. Current slug if known: ${item?.slug ?? "look it up"}.`,
      );
      await refreshGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);
      continue;
    }

    try {
      await handleAgentTurn(runtime, trimmed);
      await refreshGatewayWorkingMemory(memory, memorySession, ctx.currentWorkItem);
    } catch (error: unknown) {
      console.error(
        `\nengineering-lead> Error: ${error instanceof Error ? error.message : error}\n`,
      );
    }
  }

  rl.close();
  console.log("Gateway closed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
