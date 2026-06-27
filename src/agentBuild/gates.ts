import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { chmodSync } from "node:fs";
import { execSync } from "node:child_process";
import type { GateResult } from "./types.js";

export function hashFile(path: string): string {
  const content = readFileSync(path);
  return createHash("sha256").update(content).digest("hex");
}

export function saveAcceptanceHash(
  acceptanceTestPath: string,
  hashPath: string,
): string {
  const hash = hashFile(acceptanceTestPath);
  writeFileSync(hashPath, `${hash}\n`, "utf-8");
  return hash;
}

export function verifyAcceptanceHash(
  acceptanceTestPath: string,
  expectedHash: string,
): boolean {
  return hashFile(acceptanceTestPath) === expectedHash.trim();
}

export function runAcceptanceTest(
  worktreePath: string,
  acceptanceTestRelativePath: string,
): GateResult {
  const lines: string[] = [];
  let exitCode: number | null = 0;
  let passed = false;

  try {
    const output = execSync(
      `npx vitest run ${JSON.stringify(acceptanceTestRelativePath)}`,
      { cwd: worktreePath, encoding: "utf-8", stdio: "pipe" },
    );
    lines.push(output);
    passed = true;
    exitCode = 0;
  } catch (error: unknown) {
    const err = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    exitCode = typeof err.status === "number" ? err.status : 1;
    passed = false;
    lines.push(err.stdout ?? "", err.stderr ?? "", err.message ?? "");
  }

  return {
    passed,
    exitCode,
    log: lines.filter(Boolean).join("\n"),
  };
}

export type RedGreenGateOutcome = {
  red: GateResult;
  green: GateResult;
  redGateValid: boolean;
  greenGateValid: boolean;
  acceptanceHashUnchanged: boolean;
  messages: string[];
};

export function lockAcceptanceTest(acceptanceTestPath: string): void {
  chmodSync(acceptanceTestPath, 0o444);
}

export function unlockAcceptanceTest(acceptanceTestPath: string): void {
  chmodSync(acceptanceTestPath, 0o644);
}

export function evaluateRedGreenGates(
  red: GateResult,
  green: GateResult,
  acceptanceHashUnchanged: boolean,
): RedGreenGateOutcome {
  const messages: string[] = [];
  const redGateValid = !red.passed;
  const greenGateValid = green.passed && acceptanceHashUnchanged;

  if (red.passed) {
    messages.push(
      "RED gate failed integrity check: acceptance test passed before implementation (likely tautological).",
    );
  } else {
    messages.push("RED gate OK: acceptance test failed before implementation.");
  }

  if (!green.passed) {
    messages.push("GREEN gate failed: acceptance test did not pass after implementation.");
  } else if (!acceptanceHashUnchanged) {
    messages.push(
      "GREEN gate failed: acceptance test file was modified during implementation.",
    );
  } else {
    messages.push("GREEN gate OK: acceptance test passed and hash unchanged.");
  }

  return {
    red,
    green,
    redGateValid,
    greenGateValid,
    acceptanceHashUnchanged,
    messages,
  };
}
