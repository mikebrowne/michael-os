import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  canShipFromManifest,
  hashAcceptanceTestContent,
  writeBuildManifest,
  type BuildManifest,
} from "../src/engineering/buildManifest.js";

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
      const hash = hashAcceptanceTestContent(content);
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
