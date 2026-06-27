import { execSync } from "node:child_process";

export type WorktreeInfo = {
  repoPath: string;
  worktreePath: string;
  branchName: string;
};

export function createWorktree(
  repoPath: string,
  worktreePath: string,
  slug: string,
): WorktreeInfo {
  const branchName = `ai/${slug}-${Date.now()}`;
  execSync(
    `git worktree add -b ${branchName} ${JSON.stringify(worktreePath)} HEAD`,
    { cwd: repoPath, stdio: "pipe" },
  );
  return { repoPath, worktreePath, branchName };
}

export function installDependencies(worktreePath: string): void {
  execSync("npm ci", { cwd: worktreePath, stdio: "pipe" });
}

export function removeWorktree(repoPath: string, info: WorktreeInfo): void {
  try {
    execSync(`git worktree remove --force ${JSON.stringify(info.worktreePath)}`, {
      cwd: repoPath,
      stdio: "pipe",
    });
  } catch {
    // worktree may already be removed
  }
  try {
    execSync(`git branch -D ${info.branchName}`, {
      cwd: repoPath,
      stdio: "pipe",
    });
  } catch {
    // branch may already be deleted
  }
}

export function captureGitDiff(worktreePath: string): string {
  return execSync("git diff", { cwd: worktreePath, encoding: "utf-8" });
}

export function listChangedFiles(worktreePath: string): string[] {
  const out = execSync("git diff --name-only", {
    cwd: worktreePath,
    encoding: "utf-8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
