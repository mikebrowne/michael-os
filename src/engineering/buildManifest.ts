import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunAgentBuildResult } from "../agentBuild/runAgentBuild.js";
import type { WorkItem } from "./workItem.js";
import { evaluateRedGreenGates, hashFile } from "../agentBuild/gates.js";

export type BuildManifest = {
  runId: string;
  worktreePath: string;
  success: boolean;
  acceptanceHash: string;
  acceptanceRelativePath: string;
  baseCommit: string;
  changedFiles: string[];
  createdAt: string;
  request: string;
  runDir: string;
};

export const BUILD_MANIFEST_FILENAME = "build-manifest.json";

export function buildManifestPath(runDir: string): string {
  return join(runDir, BUILD_MANIFEST_FILENAME);
}

export function writeBuildManifest(
  runDir: string,
  manifest: BuildManifest,
): string {
  const path = buildManifestPath(runDir);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  return path;
}

export function readBuildManifest(manifestPath: string): BuildManifest {
  const raw = readFileSync(manifestPath, "utf-8");
  return JSON.parse(raw) as BuildManifest;
}

export function hashAcceptanceTestContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export function hashAcceptanceTestFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return hashFile(filePath);
}

export type ManifestShipGuardResult =
  | { ok: true; manifest: BuildManifest }
  | { ok: false; reason: string };

export function canShipFromManifest(
  repoPath: string,
  manifest: BuildManifest,
  currentAcceptancePath?: string,
): ManifestShipGuardResult {
  if (!manifest.success) {
    return { ok: false, reason: "Build manifest records a non-green build." };
  }
  if (!existsSync(manifest.worktreePath)) {
    return {
      ok: false,
      reason: "Worktree no longer exists; rebuild required.",
    };
  }

  const acceptanceFile =
    currentAcceptancePath ??
    join(manifest.worktreePath, manifest.acceptanceRelativePath);
  const currentHash = hashAcceptanceTestFile(acceptanceFile);
  if (!currentHash) {
    return {
      ok: false,
      reason: "Acceptance test file missing from worktree; rebuild required.",
    };
  }
  if (currentHash !== manifest.acceptanceHash) {
    return {
      ok: false,
      reason: "Acceptance test hash mismatch; rebuild required.",
    };
  }

  return { ok: true, manifest };
}

function minimalBuildResultFromManifest(
  manifest: BuildManifest,
): RunAgentBuildResult {
  return {
    runId: manifest.runId,
    runDir: manifest.runDir,
    resultPath: join(manifest.runDir, "result.md"),
    worktreePath: manifest.worktreePath,
    success: manifest.success,
    request: manifest.request,
    specSummary: "",
    changedFiles: manifest.changedFiles,
    gitDiff: existsSync(join(manifest.runDir, "git-diff.patch"))
      ? readFileSync(join(manifest.runDir, "git-diff.patch"), "utf-8")
      : "",
    markdown: "",
    cursorResult: {
      started: true,
      status: "finished",
      summary: "Rehydrated from build manifest.",
    },
    gateOutcome: evaluateRedGreenGates(
      { passed: false, exitCode: 1, log: "" },
      { passed: true, exitCode: 0, log: "" },
      true,
    ),
    preflight: { passed: true, steps: [], log: "" },
    manifestPath: buildManifestPath(manifest.runDir),
    acceptanceHash: manifest.acceptanceHash,
  };
}

export function rehydrateBuildFromWorkItem(
  repoPath: string,
  item: WorkItem,
): RunAgentBuildResult | null {
  if (!item.manifestPath || !item.lastBuildSuccess) {
    return null;
  }
  if (!existsSync(item.manifestPath)) {
    return null;
  }
  const manifest = readBuildManifest(item.manifestPath);
  const guard = canShipFromManifest(
    repoPath,
    manifest,
    join(manifest.worktreePath, manifest.acceptanceRelativePath),
  );
  if (!guard.ok) {
    return null;
  }
  return minimalBuildResultFromManifest(manifest);
}

export function tryRehydrateBuildResult(
  ctx: {
    repoPath: string;
    lastBuildResult: RunAgentBuildResult | null;
    currentWorkItem: WorkItem | null;
  },
): RunAgentBuildResult | null {
  if (ctx.lastBuildResult && ctx.lastBuildResult.success) {
    return ctx.lastBuildResult;
  }
  if (!ctx.currentWorkItem) {
    return null;
  }
  return rehydrateBuildFromWorkItem(ctx.repoPath, ctx.currentWorkItem);
}
