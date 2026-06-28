import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GitRunner } from "./ship.js";
import {
  filterImplementationFiles,
  type ShipImplementationInput,
} from "./ship.js";
import {
  createPullRequest,
  mergePullRequest,
  type GhRunner,
} from "./github.js";
import type { PromotionRegistry } from "./promotionRegistry.js";
import type { GateOverride } from "./promotionRegistry.js";

export type StageBuildInput = {
  repoPath: string;
  worktreePath: string;
  slug: string;
  runId: string;
  title: string;
  prBody: string;
  commitMessage: string;
  changedFiles: string[];
  githubRepo: string;
};

export type StageBuildResult = {
  branchName: string;
  prNumber: number;
  stagedFiles: string[];
};

export type PromoteBuildInput = {
  repoPath: string;
  githubRepo: string;
  branchName: string;
  prNumber: number;
  parentWorkItem: string;
  issueNumber?: number;
  jobId?: string;
  commitMessage: string;
  gatesPassed?: string[];
  gatesOverridden?: GateOverride[];
};

export type RollbackPromotionInput = {
  repoPath: string;
  promotionNumber: number;
  revertMessage?: string;
};

export function buildFeatureBranchName(slug: string, runId: string): string {
  const shortRunId = runId.slice(0, 8);
  return `feature/${slug}-${shortRunId}`;
}

function runGit(runner: GitRunner, repoPath: string, args: string[]): string {
  const result = runner(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `git failed: ${args.join(" ")}`);
  }
  return result.stdout.trim();
}

export function copyWorktreeFilesToRepo(
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

export function assertNoDirectPushToMain(commands: string[][]): void {
  for (const cmd of commands) {
    const pushIdx = cmd.indexOf("push");
    if (pushIdx >= 0 && cmd[pushIdx + 1] === "origin" && cmd[pushIdx + 2] === "main") {
      throw new Error(
        "Direct push to main is not allowed. Use stage + promote instead.",
      );
    }
  }
}

export async function stageBuild(
  input: StageBuildInput,
  gitRunner: GitRunner,
  ghRunner: GhRunner,
): Promise<StageBuildResult> {
  const files = filterImplementationFiles(input.changedFiles);
  if (files.length === 0) {
    throw new Error("No implementation files to stage.");
  }

  const branchName = buildFeatureBranchName(input.slug, input.runId);
  const repoPath = input.repoPath;

  runGit(gitRunner, repoPath, ["checkout", "main"]);
  runGit(gitRunner, repoPath, ["pull", "origin", "main"]);
  runGit(gitRunner, repoPath, ["checkout", "-b", branchName]);

  copyWorktreeFilesToRepo(input.worktreePath, repoPath, files);
  runGit(gitRunner, repoPath, ["add", ...files]);
  runGit(gitRunner, repoPath, ["commit", "-m", input.commitMessage]);
  runGit(gitRunner, repoPath, ["push", "-u", "origin", branchName]);

  const pr = await createPullRequest(ghRunner, input.githubRepo, {
    title: input.title,
    body: input.prBody,
    head: branchName,
    base: "main",
    draft: true,
  });

  if (!pr.prNumber) {
    throw new Error("Failed to parse PR number from gh pr create output.");
  }

  return {
    branchName,
    prNumber: pr.prNumber,
    stagedFiles: files,
  };
}

export async function promoteStagedChange(
  input: PromoteBuildInput,
  gitRunner: GitRunner,
  ghRunner: GhRunner,
  promotionRegistry: PromotionRegistry,
): Promise<import("./promotionRegistry.js").PromotionRecord> {
  await mergePullRequest(ghRunner, input.githubRepo, input.prNumber);

  const repoPath = input.repoPath;
  runGit(gitRunner, repoPath, ["checkout", "main"]);
  runGit(gitRunner, repoPath, ["pull", "origin", "main"]);
  runGit(gitRunner, repoPath, [
    "merge",
    "--no-ff",
    input.branchName,
    "-m",
    input.commitMessage,
  ]);
  runGit(gitRunner, repoPath, ["push", "origin", "main"]);

  const commitSha = runGit(gitRunner, repoPath, ["rev-parse", "HEAD"]);

  return promotionRegistry.createPromotion({
    commitSha,
    parentWorkItem: input.parentWorkItem,
    issueNumber: input.issueNumber,
    jobId: input.jobId,
    prNumber: input.prNumber,
    branchName: input.branchName,
    gatesPassed: input.gatesPassed,
    gatesOverridden: input.gatesOverridden,
  });
}

export async function rollbackPromotion(
  input: RollbackPromotionInput,
  gitRunner: GitRunner,
  promotionRegistry: PromotionRegistry,
): Promise<import("./promotionRegistry.js").PromotionRecord> {
  const promotion = await promotionRegistry.getPromotionByNumber(
    input.promotionNumber,
  );
  if (!promotion) {
    throw new Error(`Promotion #${input.promotionNumber} not found.`);
  }
  if (promotion.status === "rolled-back") {
    throw new Error(`Promotion #${input.promotionNumber} is already rolled back.`);
  }

  const repoPath = input.repoPath;
  runGit(gitRunner, repoPath, ["checkout", "main"]);
  runGit(gitRunner, repoPath, ["pull", "origin", "main"]);
  runGit(gitRunner, repoPath, [
    "revert",
    "--no-edit",
    "-m",
    "1",
    promotion.commitSha,
  ]);
  runGit(gitRunner, repoPath, ["push", "origin", "main"]);

  const revertCommitSha = runGit(gitRunner, repoPath, ["rev-parse", "HEAD"]);

  const updated = await promotionRegistry.updatePromotion(promotion.id, {
    status: "rolled-back",
    revertCommitSha,
  });
  if (!updated) {
    throw new Error("Failed to update promotion record after rollback.");
  }
  return updated;
}

export function rejectDirectShipImplementation(): never {
  throw new Error(
    "Direct push to main is not allowed. Stage the build as a PR, verify, then promote.",
  );
}

export function validateShipImplementationReplaced(
  input: ShipImplementationInput,
): void {
  if (input.operatorConfirmed) {
    rejectDirectShipImplementation();
  }
}
