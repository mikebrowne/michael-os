import type { RunAgentBuildResult } from "../agentBuild/runAgentBuild.js";
import { isBuildGreen } from "../agentBuild/runAgentBuild.js";
import { join, dirname } from "node:path";
import { copyFileSync, mkdirSync } from "node:fs";
import { rejectDirectShipImplementation } from "./staging.js";

export type GitRunner = (args: string[]) => { stdout: string; stderr: string; exitCode: number };

export type ShipDocsInput = {
  repoPath: string;
  files: string[];
  message: string;
};

export type ShipImplementationInput = {
  repoPath: string;
  worktreePath: string;
  buildResult: RunAgentBuildResult;
  message: string;
  operatorConfirmed: boolean;
};

export function assertBuildGreenForShip(
  buildResult: RunAgentBuildResult,
  operatorConfirmed: boolean,
): void {
  if (!isBuildGreen(buildResult)) {
    throw new Error("Cannot ship: build is not green.");
  }
  if (!operatorConfirmed) {
    throw new Error("Cannot ship: operator confirmation required.");
  }
}

export function buildCommitDocsCommands(input: ShipDocsInput): string[][] {
  return [
    ["git", "add", ...input.files],
    ["git", "commit", "-m", input.message],
    ["git", "push", "origin", "main"],
  ];
}

export function filterImplementationFiles(files: string[]): string[] {
  return files.filter(
    (f) =>
      !f.startsWith("tests/acceptance/") &&
      f !== "tests/acceptance/agent-build.test.ts",
  );
}

export function copyImplementationFiles(
  worktreePath: string,
  repoPath: string,
  files: string[],
): void {
  for (const rel of files) {
    const src = join(worktreePath, rel);
    const dest = join(repoPath, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

export function buildShipFromWorktreeCommands(
  repoPath: string,
  files: string[],
  message: string,
): string[][] {
  const filtered = filterImplementationFiles(files);
  if (filtered.length === 0) {
    throw new Error("No implementation files to ship from worktree.");
  }
  return [
    ["git", "add", ...filtered],
    ["git", "commit", "-m", message],
    ["git", "push", "origin", "main"],
  ];
}

export function shipDocs(input: ShipDocsInput, runner: GitRunner): void {
  for (const cmd of buildCommitDocsCommands(input)) {
    const result = runner(cmd);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || result.stdout || `git failed: ${cmd.join(" ")}`);
    }
  }
}

export function shipImplementation(
  _input: ShipImplementationInput,
  _runner: GitRunner,
): string[] {
  rejectDirectShipImplementation();
}
