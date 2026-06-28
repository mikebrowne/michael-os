import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { GitRunner } from "../src/engineering/ship.js";
import type { GhRunner } from "../src/engineering/github.js";
import {
  assertNoDirectPushToMain,
  buildFeatureBranchName,
  promoteStagedChange,
  rollbackPromotion,
  stageBuild,
} from "../src/engineering/staging.js";
import {
  buildShipFromWorktreeCommands,
  shipImplementation,
} from "../src/engineering/ship.js";
import { createPromotionRegistry } from "../src/engineering/promotionRegistry.js";
import { evaluateRedGreenGates } from "../src/agentBuild/gates.js";

function runShell(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    env: { ...process.env, GIT_TEMPLATE_DIR: "" },
  }).trim();
}

function setupBareRepoFixture() {
  const dir = mkdtempSync(join(tmpdir(), "michael-os-staging-"));
  const barePath = join(dir, "remote.git");
  const repoPath = join(dir, "work");
  const worktreePath = join(dir, "worktree");
  const mastraDir = join(dir, ".mastra");

  runShell(`git init --bare "${barePath}"`, dir);
  const originUrl = `file://${barePath}`;

  runShell(`git clone "${originUrl}" work`, dir);
  runShell('git config user.email "test@test.com"', repoPath);
  runShell('git config user.name "Test User"', repoPath);
  writeFileSync(join(repoPath, "README.md"), "# test repo\n");
  runShell("git add . && git commit -m init", repoPath);
  runShell("git branch -M main", repoPath);
  runShell("git push -u origin main", repoPath);

  mkdirSync(worktreePath, { recursive: true });
  runShell(`git clone "${originUrl}" .`, worktreePath);
  runShell('git config user.email "test@test.com"', worktreePath);
  runShell('git config user.name "Test User"', worktreePath);

  return { dir, barePath, repoPath, worktreePath, mastraDir, originUrl };
}

function createGitRunner(cwd: string): GitRunner {
  return (args) => {
    try {
      const stdout = execSync(args.map((a) => JSON.stringify(a)).join(" "), {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
        env: { ...process.env, GIT_TEMPLATE_DIR: "" },
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        exitCode: typeof err.status === "number" ? err.status : 1,
      };
    }
  };
}

function createRecordingGhRunner(): {
  runner: GhRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  let prCounter = 1;
  const runner: GhRunner = async (args) => {
    calls.push([...args]);
    if (args[0] === "pr" && args[1] === "create") {
      const prNum = prCounter++;
      return {
        stdout: `https://github.com/test/repo/pull/${prNum}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    if (args[0] === "pr" && args[1] === "merge") {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: `unexpected gh: ${args.join(" ")}`, exitCode: 1 };
  };
  return { runner, calls };
}

describe("staging", () => {
  it("builds feature branch names from slug and run id", () => {
    expect(buildFeatureBranchName("my-feature", "abcd1234-5678")).toBe(
      "feature/my-feature-abcd1234",
    );
  });

  it("rejects direct push to main in ship commands", () => {
    expect(() =>
      assertNoDirectPushToMain([
        ["git", "add", "src/foo.ts"],
        ["git", "commit", "-m", "msg"],
        ["git", "push", "origin", "main"],
      ]),
    ).toThrow(/Direct push to main/);
  });

  it("shipImplementation rejects direct push to main", () => {
    const buildResult = {
      success: true,
      runId: "run-1",
      runDir: "/tmp",
      resultPath: "/tmp/result.md",
      worktreePath: "/tmp/wt",
      request: "feat",
      specSummary: "",
      changedFiles: ["src/foo.ts"],
      gitDiff: "",
      markdown: "",
      cursorResult: { started: true, status: "finished" as const, summary: "" },
      gateOutcome: evaluateRedGreenGates(
        { passed: false, exitCode: 1, log: "" },
        { passed: true, exitCode: 0, log: "" },
        true,
      ),
      preflight: { passed: true, steps: [], log: "" },
    } satisfies import("../src/agentBuild/runAgentBuild.js").RunAgentBuildResult;

    expect(() =>
      shipImplementation(
        {
          repoPath: "/tmp",
          worktreePath: "/tmp/wt",
          buildResult,
          message: "ship it",
          operatorConfirmed: true,
        },
        () => ({ stdout: "", stderr: "", exitCode: 0 }),
      ),
    ).toThrow(/Direct push to main/);
  });

  it("buildShipFromWorktreeCommands would push to main — blocked at ship layer", () => {
    const cmds = buildShipFromWorktreeCommands("/repo", ["src/a.ts"], "msg");
    expect(() => assertNoDirectPushToMain(cmds)).toThrow(/Direct push to main/);
  });

  it("stages, promotes, and rolls back against a bare-repo fake remote", async () => {
    const { dir, repoPath, worktreePath, mastraDir } = setupBareRepoFixture();
    const gitRunner = createGitRunner(repoPath);
    const { runner: ghRunner, calls: ghCalls } = createRecordingGhRunner();
    const promotionRegistry = createPromotionRegistry(mastraDir);

    try {
      const implPath = join(worktreePath, "src", "feature.ts");
      mkdirSync(join(worktreePath, "src"), { recursive: true });
      writeFileSync(implPath, "export const value = 1;\n");

      const staged = await stageBuild(
        {
          repoPath,
          worktreePath,
          slug: "test-feat",
          runId: "run-abc-123",
          title: "Test feature",
          prBody: "PRD + tests",
          commitMessage: "feat: test feature",
          changedFiles: ["src/feature.ts"],
          githubRepo: "test/repo",
        },
        gitRunner,
        ghRunner,
      );

      expect(staged.branchName).toBe("feature/test-feat-run-abc-");
      expect(staged.prNumber).toBe(1);
      expect(ghCalls.some((c) => c[0] === "pr" && c[1] === "create")).toBe(true);

      const mainBefore = runShell("git rev-parse main", repoPath);

      const promotion = await promoteStagedChange(
        {
          repoPath,
          githubRepo: "test/repo",
          branchName: staged.branchName,
          prNumber: staged.prNumber,
          parentWorkItem: "test-feat",
          issueNumber: 42,
          commitMessage: "feat: promote test feature",
        },
        gitRunner,
        ghRunner,
        promotionRegistry,
      );

      expect(promotion.promotionNumber).toBe(1);
      expect(promotion.commitSha).toBeTruthy();
      expect(promotion.parentWorkItem).toBe("test-feat");
      expect(promotion.issueNumber).toBe(42);
      expect(ghCalls.some((c) => c[0] === "pr" && c[1] === "merge")).toBe(true);

      const mainAfterPromote = runShell("git rev-parse main", repoPath);
      expect(mainAfterPromote).not.toBe(mainBefore);
      expect(
        readFileSync(join(repoPath, "src", "feature.ts"), "utf-8"),
      ).toContain("export const value");

      const rolledBack = await rollbackPromotion(
        { repoPath, promotionNumber: 1 },
        gitRunner,
        promotionRegistry,
      );

      expect(rolledBack.status).toBe("rolled-back");
      expect(rolledBack.revertCommitSha).toBeTruthy();

      const log = runShell("git log --oneline -5", repoPath);
      expect(log).toContain("Revert");

      const history = runShell("git rev-list --count main", repoPath);
      expect(Number(history)).toBeGreaterThan(2);
    } finally {
      await promotionRegistry.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
