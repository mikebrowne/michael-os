import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadSkillEvalCases,
  runDeterministicSkillEval,
  scoreEvalOutput,
  executeFixtureSideEffect,
  cleanupFixtureSideEffect,
  FIXTURE_SIDE_EFFECT_MOCK,
} from "../src/skills/skillEvalRunner.js";
import {
  SKILL_TEST_MODE_KEY,
  createSkillEvalRequestContext,
  isSkillTestMode,
} from "../src/skills/skillTestMode.js";
import { createObservabilityStore } from "../src/observability/observabilityStore.js";
import { createObservabilityConfig } from "../src/observability/observabilityConfig.js";
import { createSkillTelemetry } from "../src/skills/skillTelemetry.js";

const REPO_ROOT = process.cwd();

describe("skill EDD harness", () => {
  it("loads code-review eval cases from evals/*.json", () => {
    const cases = loadSkillEvalCases(REPO_ROOT, "code-review");
    expect(cases.length).toBeGreaterThan(0);
    expect(cases[0]?.input).toBeTruthy();
    expect(cases[0]?.expectedBehavior).toBeTruthy();
  });

  it("scores output against expectedBehavior and assertions", () => {
    const result = scoreEvalOutput(
      '{"decision":"approve","rationale":"ok","findings":[]}',
      {
        input: "review",
        expectedBehavior: "decision approve rationale findings json",
        assertions: ["decision", "rationale"],
      },
    );
    expect(result.passed).toBe(true);
  });

  it("runDeterministicSkillEval passes for code-review seed case", () => {
    const outcome = runDeterministicSkillEval(REPO_ROOT, "code-review");
    expect(outcome.mode).toBe("deterministic-instructions");
    expect(outcome.results.length).toBeGreaterThan(0);
    expect(outcome.passed).toBe(true);
  });

  it("testMode key is readable on RequestContext", () => {
    const ctx = createSkillEvalRequestContext();
    expect(ctx.get(SKILL_TEST_MODE_KEY)).toBe(true);
    expect(isSkillTestMode(ctx)).toBe(true);
    expect(isSkillTestMode(undefined)).toBe(false);
  });

  it("fixture side effect is mocked under testMode with telemetry", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-skill-fixture-"));
    try {
      const sideEffectPath = join(dir, "side-effect.txt");
      const store = createObservabilityStore({
        logDir: dir,
        mastraDir: join(dir, ".mastra"),
        config: createObservabilityConfig({ level: "standard" }),
      });
      const telemetry = createSkillTelemetry(store);

      const mocked = executeFixtureSideEffect(
        { sideEffectPath, skillTelemetry: telemetry, skillName: "fixture" },
        true,
      );
      expect(mocked.mocked).toBe(true);
      expect(mocked.result).toEqual(FIXTURE_SIDE_EFFECT_MOCK);
      expect(mocked.sideEffectWritten).toBe(false);
      expect(existsSync(sideEffectPath)).toBe(false);

      const live = executeFixtureSideEffect(
        { sideEffectPath, skillTelemetry: telemetry, skillName: "fixture" },
        false,
      );
      expect(live.sideEffectWritten).toBe(true);
      expect(existsSync(sideEffectPath)).toBe(true);
      cleanupFixtureSideEffect(sideEffectPath);

      const events = readFileSync(store.getLogFilePath(), "utf-8");
      expect(events).toContain("skill.tool_invoked");
      expect(events).toContain('"mocked":true');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
