import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  canShipFromManifest,
  rehydrateBuildFromWorkItem,
  writeBuildManifest,
  type BuildManifest,
} from "../src/engineering/buildManifest.js";
import { hashFile } from "../src/agentBuild/gates.js";
import type { WorkItem } from "../src/engineering/workItem.js";

function sampleManifest(overrides: Partial<BuildManifest> = {}): BuildManifest {
  return {
    runId: "run-1",
    worktreePath: "/tmp/wt",
    success: true,
    acceptanceHash: "abc",
    acceptanceRelativePath: "tests/acceptance/agent-build.test.ts",
    baseCommit: "deadbeef",
    changedFiles: ["src/utils/greet.ts"],
    createdAt: new Date().toISOString(),
    request: "test",
    runDir: "/tmp/run",
    ...overrides,
  };
}

describe("buildManifest", () => {
  it("refuses ship when build was not green", () => {
    const result = canShipFromManifest(
      "/repo",
      sampleManifest({ success: false }),
    );
    expect(result.ok).toBe(false);
  });

  it("refuses ship when worktree is missing", () => {
    const result = canShipFromManifest(
      "/repo",
      sampleManifest({ worktreePath: "/nonexistent/wt" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("Worktree");
    }
  });

  it("allows ship when worktree exists and hash matches", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-manifest-"));
    try {
      const wt = join(dir, "worktree");
      const acceptanceRel = "tests/acceptance/agent-build.test.ts";
      const acceptancePath = join(wt, acceptanceRel);
      mkdirSync(join(wt, "tests", "acceptance"), { recursive: true });
      const content = "export const x = 1;\n";
      writeFileSync(acceptancePath, content, "utf-8");
      const hash = hashFile(acceptancePath);
      const manifest = sampleManifest({
        worktreePath: wt,
        acceptanceHash: hash,
        acceptanceRelativePath: acceptanceRel,
      });
      const result = canShipFromManifest(dir, manifest);
      expect(result.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rehydrates green build when manifest hash matches gates hashFile", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-manifest-rehydrate-"));
    try {
      const runDir = join(dir, "run");
      const wt = join(runDir, "worktree");
      const acceptanceRel = "tests/acceptance/agent-build.test.ts";
      const acceptancePath = join(wt, acceptanceRel);
      mkdirSync(join(wt, "tests", "acceptance"), { recursive: true });
      writeFileSync(acceptancePath, "test('x', () => {});\n", "utf-8");
      const hash = hashFile(acceptancePath);
      const manifestPath = writeBuildManifest(runDir, {
        runId: "run-rehydrate",
        worktreePath: wt,
        success: true,
        acceptanceHash: hash,
        acceptanceRelativePath: acceptanceRel,
        baseCommit: "abc",
        changedFiles: [],
        createdAt: new Date().toISOString(),
        request: "test",
        runDir,
      });
      const item: WorkItem = {
        id: "test-item",
        slug: "test-item",
        title: "Test",
        stage: "build",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastBuildSuccess: true,
        manifestPath,
        acceptanceHash: hash,
      };
      const result = rehydrateBuildFromWorkItem(dir, item);
      expect(result).not.toBeNull();
      expect(result?.success).toBe(true);
      expect(result?.runId).toBe("run-rehydrate");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes manifest JSON to run dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-manifest-write-"));
    try {
      const path = writeBuildManifest(dir, sampleManifest({ runDir: dir }));
      expect(path).toContain("build-manifest.json");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
