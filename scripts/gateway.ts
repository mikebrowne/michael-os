import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import {
  grantApproval,
  parseYesNo,
  needsApprovalMessage,
} from "../src/engineering/approvalGate.js";
import { ensurePrdsDir } from "../src/engineering/workItem.js";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = createEngineeringSessionContext(config);
  const agent = createEngineeringLeadAgent(config.defaultModel, ctx);

  const rl = readline.createInterface({ input, output });

  console.log("MichaelOS Engineering Gateway");
  console.log("Chat with the Engineering Lead. Commands: exit | resume #N | list");
  console.log("Dangerous actions require YES when prompted.\n");

  let pendingToolRetry: string | null = null;

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
        pendingToolRetry = toolId;
        console.log(`\nengineering-lead> Approved ${toolId}. Retrying...\n`);
        const response = await agent.generate(
          `Operator approved ${toolId}. Retry the tool now.`,
        );
        console.log(`\nengineering-lead> ${response.text ?? "(no response)"}\n`);
        pendingToolRetry = null;
        continue;
      }
      ctx.approval.pending = undefined;
      pendingToolRetry = null;
      console.log("\nengineering-lead> Cancelled.\n");
      continue;
    }

    if (trimmed.toLowerCase() === "list") {
      const response = await agent.generate(
        "Use list-in-progress and summarize open work items for the operator.",
      );
      console.log(`\nengineering-lead> ${response.text ?? "(no response)"}\n`);
      continue;
    }

    const resumeMatch = trimmed.match(/^resume\s+#?(\d+)$/i);
    if (resumeMatch) {
      const issueNumber = Number(resumeMatch[1]);
      const response = await agent.generate(
        `Resume work for GitHub issue #${issueNumber}. Use resume-work-item and summarize state.`,
      );
      console.log(`\nengineering-lead> ${response.text ?? "(no response)"}\n`);
      continue;
    }

    try {
      const response = await agent.generate(trimmed);
      const text = response.text ?? "(no response)";

      if (text.includes("needsApproval") || ctx.approval.pending) {
        pendingToolRetry = ctx.approval.pending ?? pendingToolRetry;
        if (ctx.approval.pending) {
          console.log(`\nengineering-lead> ${needsApprovalMessage(ctx.approval.pending)}\n`);
        }
      }

      console.log(`\nengineering-lead> ${text}\n`);
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
