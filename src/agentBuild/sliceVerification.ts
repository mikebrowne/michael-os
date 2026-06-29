import { execSync } from "node:child_process";

export type SliceVerifyStep = {
  name: string;
  passed: boolean;
  log: string;
};

export type SliceVerifyResult = {
  passed: boolean;
  steps: SliceVerifyStep[];
};

export function runSliceVerification(
  worktreePath: string,
  targetedTestFiles: string[] = [],
): SliceVerifyResult {
  const steps: SliceVerifyStep[] = [];

  for (const script of ["typecheck", "lint"] as const) {
    try {
      const output = execSync(`npm run ${script}`, {
        cwd: worktreePath,
        encoding: "utf-8",
        stdio: "pipe",
      });
      steps.push({ name: script, passed: true, log: output.slice(0, 4000) });
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const log = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
      steps.push({ name: script, passed: false, log: log.slice(0, 4000) });
    }
  }

  for (const testFile of targetedTestFiles) {
    try {
      const output = execSync(`npx vitest run ${JSON.stringify(testFile)}`, {
        cwd: worktreePath,
        encoding: "utf-8",
        stdio: "pipe",
      });
      steps.push({
        name: `test:${testFile}`,
        passed: true,
        log: output.slice(0, 4000),
      });
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      const log = [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
      steps.push({
        name: `test:${testFile}`,
        passed: false,
        log: log.slice(0, 4000),
      });
    }
  }

  return {
    passed: steps.every((s) => s.passed),
    steps,
  };
}
