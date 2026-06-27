/**
 * One-shot manual smoke test for the Engineering gateway loop.
 * Drives the same agent + session context as scripts/gateway.ts with scripted operator messages.
 * Skips ship-implementation to avoid pushing code to main during smoke runs.
 */
import { loadConfig, requireOpenAiKey, requireCursorKey } from "../src/config/loadConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import {
  grantApproval,
  needsApprovalMessage,
} from "../src/engineering/approvalGate.js";
import { ensurePrdsDir } from "../src/engineering/workItem.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SLUG = "greet-utility-smoke-test";

const STEPS: string[] = [
  `Run a Phase 2 gateway smoke test. Title must be exactly "greet utility smoke test" (slug will be greet-utility-smoke-test).

All grill decisions are already made — do NOT interview further. Call save-grill-notes now with:
- Objective: add src/utils/greet.ts with greet(name: string) returning "Hello, {name}!"
- Empty string returns "Hello, !"
- Vitest, ESM imports, no new dependencies
- Out of scope: CLI, API, unrelated files`,

  `Grill notes saved. Run to-prd now: write the PRD to docs/prds/${SLUG}.md and create a GitHub issue. Do not ask for confirmation.`,

  `PRD is ready. Run research-write-tests: append a test plan to the PRD and save one red acceptance test at tests/acceptance/agent-build.test.ts for slug "${SLUG}". Do not ask for confirmation.`,

  `Tests are ready. Run build-handoff: call run-build for slug "${SLUG}" with request summary "Add greet utility smoke test".`,

  `exit`,
];

async function generate(
  agent: ReturnType<typeof createEngineeringLeadAgent>,
  ctx: ReturnType<typeof createEngineeringSessionContext>,
  message: string,
  preApproveRunBuild = false,
): Promise<string> {
  console.log(`\n--- operator ---\n${message}\n`);
  if (preApproveRunBuild) {
    grantApproval(ctx.approval, "run-build");
  }
  const response = await agent.generate(message);
  const text = response.text ?? "(no response)";

  if (ctx.approval.pending) {
    console.log(`\n--- approval required: ${needsApprovalMessage(ctx.approval.pending)} ---`);
    if (ctx.approval.pending === "run-build") {
      requireCursorKey(ctx.config);
      grantApproval(ctx.approval, "run-build");
      console.log("--- auto-approved run-build (YES) ---\n");
      const retry = await agent.generate(
        "Operator approved run-build. Retry the tool now.",
      );
      return retry.text ?? "(no response after approval)";
    }
    console.log(`--- skipping approval for ${ctx.approval.pending} in smoke test ---\n`);
    ctx.approval.pending = undefined;
  }

  return text;
}

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);
  ensurePrdsDir(config.prdsDir);

  const ctx = createEngineeringSessionContext(config);
  const agent = createEngineeringLeadAgent(config.defaultModel, ctx);

  console.log("MichaelOS Gateway Smoke Test");
  console.log(`Slug: ${SLUG}`);
  console.log("Skipping ship-implementation (main stays unchanged).\n");

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const preApprove = step.includes("run-build");
    const text = await generate(agent, ctx, step, preApprove);
    console.log(`\n--- engineering-lead ---\n${text}\n`);
    if (ctx.currentWorkItem?.slug) {
      console.log(`(current slug: ${ctx.currentWorkItem.slug})`);
    }
  }

  const slug = ctx.currentWorkItem?.slug ?? SLUG;
  const paths = {
    grill: join(config.prdsDir, `${slug}.grill.md`),
    prd: join(config.prdsDir, `${slug}.md`),
    state: join(config.stateDir, "work-items.json"),
  };

  console.log("\n=== Artifacts ===");
  for (const [label, path] of Object.entries(paths)) {
    console.log(`${label}: ${existsSync(path) ? "OK" : "MISSING"} (${path})`);
  }

  if (ctx.lastBuildResult) {
    console.log(`build success: ${ctx.lastBuildResult.success}`);
    console.log(`build runDir: ${ctx.lastBuildResult.runDir}`);
  } else {
    console.log("build: not run");
  }

  if (ctx.currentWorkItem?.issueNumber) {
    console.log(`issue: #${ctx.currentWorkItem.issueNumber}`);
  }

  if (existsSync(paths.state)) {
    const state = JSON.parse(readFileSync(paths.state, "utf-8")) as {
      items?: Array<{ slug: string; stage: string }>;
    };
    const item = state.items?.find((x) => x.slug === slug);
    if (item) console.log(`work item stage: ${item.stage}`);
  }

  const failed =
    !existsSync(paths.grill) ||
    !existsSync(paths.prd) ||
    !ctx.lastBuildResult?.success;

  if (failed) {
    console.error("\nSmoke test FAILED — see output above.");
    process.exit(1);
  }

  console.log("\nSmoke test PASSED (planning + green build).");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
