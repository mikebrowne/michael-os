#!/usr/bin/env tsx
/**
 * Local-only Phase 6 skill EDD evals.
 * Requires OPENAI_API_KEY — not run in CI.
 */
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, requireOpenAiKey } from "../src/config/loadConfig.js";
import { createQaEngineerAgent } from "../src/mastra/agents/qa-engineer.js";
import { createEngineeringLeadAgent } from "../src/mastra/agents/engineering-lead.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createEngineeringSessionContext } from "../src/engineering/sessionContext.js";
import { createJobRegistry } from "../src/engineering/jobRegistry.js";
import { createJobRunner } from "../src/engineering/jobRunner.js";
import { runCodeReview, reviewVerdictSchema } from "../src/engineering/review.js";
import {
  loadSkillEvalCases,
  runDeterministicSkillEval,
  executeFixtureSideEffect,
  cleanupFixtureSideEffect,
} from "../src/skills/skillEvalRunner.js";
import { createSkillTelemetry } from "../src/skills/skillTelemetry.js";
import { createSkillEvalRequestContext } from "../src/skills/skillTestMode.js";

const REPO_ROOT = process.cwd();

const SAMPLE_DIFF = `
diff --git a/src/greet.ts b/src/greet.ts
+export function greet(name: string) {
+  return \`Hello, \${name}\`;
+}
`;

function logStep(message: string): void {
  console.error(`eval:skills — ${message}`);
}

async function main() {
  const config = loadConfig();
  requireOpenAiKey(config);

  const dir = mkdtempSync(join(tmpdir(), "michael-os-eval-skills-"));
  const results: Record<string, boolean> = {};

  try {
    logStep("deterministic: code-review eval cases load");
    const cases = loadSkillEvalCases(REPO_ROOT, "code-review");
    results["eval-cases-load"] = cases.length > 0 && Boolean(cases[0]?.input);

    logStep("deterministic: instruction-aligned eval scoring");
    const deterministic = runDeterministicSkillEval(REPO_ROOT, "code-review");
    results["deterministic-instruction-eval"] = deterministic.passed;

    logStep("deterministic: testMode fixture suppresses side effect");
    const sideEffectPath = join(dir, "fixture-side-effect.txt");
    const observability = createObservabilityStore({
      logDir: join(dir, "logs"),
      mastraDir: join(dir, ".mastra"),
      config: createObservabilityConfig({ level: "standard" }),
    });
    const skillTelemetry = createSkillTelemetry(observability);
    const mocked = executeFixtureSideEffect(
      { sideEffectPath, skillTelemetry, skillName: "code-review" },
      true,
    );
    const live = executeFixtureSideEffect(
      { sideEffectPath, skillTelemetry, skillName: "code-review" },
      false,
    );
    cleanupFixtureSideEffect(sideEffectPath);
    results["testmode-mocks-side-effect"] =
      mocked.mocked && !mocked.sideEffectWritten && live.sideEffectWritten;
    const logEvents = observability.getLogFilePath();
    results["testmode-emits-mocked-telemetry"] =
      existsSync(logEvents) &&
      readFileSync(logEvents, "utf-8").includes('"mocked":true');

    logStep("live: code-review verdict shape (model)");
    const qaAgent = createQaEngineerAgent(config.defaultReviewModel, REPO_ROOT);
    const verdict = await runCodeReview(qaAgent, {
      gitDiff: SAMPLE_DIFF,
      prdMarkdown: "# PRD\nGreet utility.\n",
      acceptanceTest: "test('greet', () => {})",
      changedFiles: ["src/greet.ts"],
    });
    results["skill-behavior-code-review"] = reviewVerdictSchema.safeParse(verdict).success;

    logStep("live: progressive loading recall (model)");
    const jobRegistry = createJobRegistry(join(dir, ".mastra-jobs"));
    const jobRunner = createJobRunner({ jobRegistry, observability });
    const elCtx = createEngineeringSessionContext(
      { ...config, stateDir: join(dir, "state"), logDir: join(dir, "logs-el") },
      { observability, jobRegistry, jobRunner, qaEngineerAgent: qaAgent },
    );
    const elAgent = createEngineeringLeadAgent(
      config.defaultModel,
      elCtx,
      REPO_ROOT,
      qaAgent,
    );
    const recall = await elAgent.generate(
      "Before running a post-build review step, which skill bundle should you load via the skill tool? Reply with the exact skill name only.",
      { requestContext: createSkillEvalRequestContext() },
    );
    const recallText = (recall.text ?? "").toLowerCase();
    results["progressive-loading-recall"] =
      recallText.includes("code-review") || recallText.includes("code review");

    writeFileSync(join(dir, "eval-skills-results.json"), JSON.stringify(results, null, 2));

    const passed = Object.values(results).every(Boolean);
    console.log(JSON.stringify({ passed, results }, null, 2));
    process.exit(passed ? 0 : 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
