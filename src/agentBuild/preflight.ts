import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { PreflightResult, PreflightStepResult } from "./types.js";

const PREFLIGHT_SCRIPTS = ["typecheck", "lint", "test", "build"] as const;

function readPackageScripts(worktreePath: string): Record<string, string> {
  const pkgPath = join(worktreePath, "package.json");
  if (!existsSync(pkgPath)) {
    return {};
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    scripts?: Record<string, string>;
  };
  return pkg.scripts ?? {};
}

export function runPreflight(worktreePath: string): PreflightResult {
  const scripts = readPackageScripts(worktreePath);
  const steps: PreflightStepResult[] = [];
  const logParts: string[] = [];

  for (const script of PREFLIGHT_SCRIPTS) {
    if (!scripts[script]) {
      const step: PreflightStepResult = {
        script,
        ran: false,
        passed: true,
        skipped: true,
        output: `Skipped: npm run ${script} (script not defined)\n`,
      };
      steps.push(step);
      logParts.push(`## ${script}\n${step.output}`);
      continue;
    }

    try {
      const output = execSync(`npm run ${script}`, {
        cwd: worktreePath,
        encoding: "utf-8",
        stdio: "pipe",
      });
      const step: PreflightStepResult = {
        script,
        ran: true,
        passed: true,
        skipped: false,
        output,
      };
      steps.push(step);
      logParts.push(`## ${script} — PASS\n${output}\n`);
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const output = [err.stdout ?? "", err.stderr ?? "", err.message ?? ""]
        .filter(Boolean)
        .join("\n");
      const step: PreflightStepResult = {
        script,
        ran: true,
        passed: false,
        skipped: false,
        output,
      };
      steps.push(step);
      logParts.push(`## ${script} — FAIL\n${output}\n`);
    }
  }

  const passed = steps.every((s) => s.passed);
  return { passed, steps, log: logParts.join("\n") };
}
