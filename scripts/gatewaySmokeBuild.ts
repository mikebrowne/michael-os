/**
 * Resume smoke test: run build for an existing work item slug.
 */
import { loadConfig, requireOpenAiKey, requireCursorKey } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import { grantApproval, needsApprovalMessage } from "../src/engineering/approvalGate.js";
import { getWorkItem } from "../src/engineering/workItem.js";

const SLUG = process.argv[2] ?? "greet-utility-smoke-test";

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);
  requireCursorKey(config);

  const ctx = createEngineeringSessionContext(config);
  const agent = createEngineeringLeadAgent(config.defaultModel, ctx);

  const item = getWorkItem(config.stateDir, SLUG);
  if (!item?.prdPath || !item.acceptanceTestPath) {
    throw new Error(`Work item ${SLUG} missing PRD or acceptance test`);
  }

  ctx.currentWorkItem = item;

  // Pre-grant so the first run-build tool call succeeds (retry-after-YES is unreliable).
  grantApproval(ctx.approval, "run-build");

  console.log(`Resuming build for slug: ${SLUG} (issue #${item.issueNumber ?? "n/a"})`);

  const message = `Call run-build for slug "${SLUG}" with request summary "Add greet utility smoke test". Present the full structured build report from the tool.`;
  console.log(`\n--- operator ---\n${message}\n`);

  let response = await agent.generate(message);
  let text = response.text ?? "(no response)";

  if (ctx.approval.pending === "run-build") {
    console.log(`\n--- ${needsApprovalMessage("run-build")} ---`);
    grantApproval(ctx.approval, "run-build");
    console.log("--- auto-approved YES (retry) ---\n");
    response = await agent.generate("Operator approved run-build. Retry the tool now.");
    text = response.text ?? "(no response)";
  }

  console.log(`\n--- engineering-lead ---\n${text}\n`);

  if (ctx.lastBuildResult) {
    console.log("=== Build result ===");
    console.log(`success: ${ctx.lastBuildResult.success}`);
    console.log(`runDir: ${ctx.lastBuildResult.runDir}`);
    console.log(`resultPath: ${ctx.lastBuildResult.resultPath}`);
    process.exit(ctx.lastBuildResult.success ? 0 : 1);
  }

  console.error("Build did not run — no lastBuildResult on session.");
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
