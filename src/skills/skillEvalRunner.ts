import { readdirSync, readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { loadSkillInstructions } from "./skillRegistry.js";
import type { SkillTelemetry } from "./skillTelemetry.js";

export type SkillEvalCase = {
  input: string;
  expectedBehavior: string;
  assertions?: string[];
};

export function loadSkillEvalCases(
  repoRoot: string,
  skillName: string,
): SkillEvalCase[] {
  const evalsDir = join(repoRoot, "skills", skillName, "evals");
  if (!existsSync(evalsDir)) return [];
  return readdirSync(evalsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(evalsDir, file), "utf-8");
      return JSON.parse(raw) as SkillEvalCase;
    });
}

export type SkillEvalCaseResult = {
  caseIndex: number;
  passed: boolean;
  notes: string;
};

export function scoreEvalOutput(
  output: string,
  evalCase: SkillEvalCase,
): SkillEvalCaseResult {
  const lower = output.toLowerCase();
  const notes: string[] = [];

  if (evalCase.expectedBehavior) {
    const keywords = evalCase.expectedBehavior
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4);
    const matched = keywords.filter((k) => lower.includes(k));
    if (matched.length < Math.min(2, keywords.length)) {
      notes.push("expectedBehavior keywords not reflected in output");
    }
  }

  for (const assertion of evalCase.assertions ?? []) {
    if (!lower.includes(assertion.toLowerCase())) {
      notes.push(`missing assertion: ${assertion}`);
    }
  }

  return {
    caseIndex: 0,
    passed: notes.length === 0,
    notes: notes.join("; ") || "ok",
  };
}

export async function runSkillEvalCases(
  repoRoot: string,
  skillName: string,
  runCase: (evalCase: SkillEvalCase, index: number) => Promise<string>,
): Promise<{ passed: boolean; results: SkillEvalCaseResult[] }> {
  const cases = loadSkillEvalCases(repoRoot, skillName);
  if (cases.length === 0) {
    return {
      passed: false,
      results: [
        { caseIndex: 0, passed: false, notes: "no eval cases found" },
      ],
    };
  }

  const results: SkillEvalCaseResult[] = [];
  for (let i = 0; i < cases.length; i++) {
    const output = await runCase(cases[i]!, i);
    const scored = scoreEvalOutput(output, cases[i]!);
    results.push({ ...scored, caseIndex: i });
  }

  return {
    passed: results.every((r) => r.passed),
    results,
  };
}

export const FIXTURE_SIDE_EFFECT_MOCK = {
  id: "fixture-side-effect-mock",
  status: "mocked",
} as const;

export type FixtureSideEffectOptions = {
  sideEffectPath: string;
  skillTelemetry?: SkillTelemetry;
  skillName?: string;
};

export function executeFixtureSideEffect(
  options: FixtureSideEffectOptions,
  testMode: boolean,
): { mocked: boolean; result: unknown; sideEffectWritten: boolean } {
  const { sideEffectPath, skillTelemetry, skillName = "fixture" } = options;
  if (testMode) {
    skillTelemetry?.toolInvoked(skillName, "fixture-side-effect", {
      mocked: true,
    });
    return {
      mocked: true,
      result: FIXTURE_SIDE_EFFECT_MOCK,
      sideEffectWritten: false,
    };
  }
  writeFileSync(sideEffectPath, `side-effect-${Date.now()}\n`, "utf-8");
  skillTelemetry?.toolInvoked(skillName, "fixture-side-effect", {
    mocked: false,
  });
  return {
    mocked: false,
    result: { path: sideEffectPath },
    sideEffectWritten: true,
  };
}

export function cleanupFixtureSideEffect(path: string): void {
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function runDeterministicSkillEval(
  repoRoot: string,
  skillName: string,
): { passed: boolean; results: SkillEvalCaseResult[]; mode: "deterministic-instructions" } {
  const cases = loadSkillEvalCases(repoRoot, skillName);
  if (cases.length === 0) {
    return {
      passed: false,
      mode: "deterministic-instructions",
      results: [{ caseIndex: 0, passed: false, notes: "no eval cases found" }],
    };
  }
  const instructions = loadSkillInstructions(repoRoot, skillName);
  const results = cases.map((evalCase, i) => {
    const scored = scoreEvalOutput(instructions, evalCase);
    return { ...scored, caseIndex: i };
  });
  return {
    passed: results.every((r) => r.passed),
    results,
    mode: "deterministic-instructions",
  };
}

export async function runSkillEvalWithAgent(
  agent: Agent,
  repoRoot: string,
  skillName: string,
  requestContext?: RequestContext,
): Promise<{ passed: boolean; results: SkillEvalCaseResult[]; mode: "agent" }> {
  const outcome = await runSkillEvalCases(repoRoot, skillName, async (evalCase) => {
    const result = await agent.generate(evalCase.input, { requestContext });
    return typeof result.text === "string" ? result.text : JSON.stringify(result);
  });
  return { ...outcome, mode: "agent" };
}
