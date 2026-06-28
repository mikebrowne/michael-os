import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyNoRoute,
  parseNoWithRoute,
  type NoRoute,
} from "../src/engineering/noRouting.js";
import {
  createWorkItem,
  getWorkItem,
  upsertWorkItem,
} from "../src/engineering/workItem.js";
import type { GhRunner } from "../src/engineering/github.js";

function createRecordingGhRunner(): {
  runner: GhRunner;
  calls: string[][];
} {
  const calls: string[][] = [];
  const runner: GhRunner = async (args) => {
    calls.push(args);
    return { stdout: "", stderr: "", exitCode: 0 };
  };
  return { runner, calls };
}

describe("noRouting", () => {
  const routes: NoRoute[] = ["fix", "re-spec", "park", "abandon"];

  it.each(routes)("parseNoWithRoute recognizes no %s", (route) => {
    const parsed = parseNoWithRoute(`no ${route}`);
    expect(parsed).toEqual({ decision: "no", route });
  });

  it("parseNoWithRoute defaults plain no to fix", () => {
    expect(parseNoWithRoute("no")).toEqual({ decision: "no", route: "fix" });
    expect(parseNoWithRoute("cancel")).toEqual({ decision: "no", route: "fix" });
  });

  it("fix route keeps work item staged for remediation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-noroute-"));
    try {
      const item = upsertWorkItem(dir, {
        ...createWorkItem("feat-fix"),
        stage: "staged",
        stagedPrNumber: 42,
        stagedBranchName: "feature/feat-fix-abc",
        remediationAttemptCount: 1,
      });

      const { runner } = createRecordingGhRunner();
      const result = await applyNoRoute({
        route: "fix",
        workItem: item,
        stateDir: dir,
        githubRepo: "org/repo",
        ghRunner: runner,
      });

      expect(result.workItem.stage).toBe("staged");
      expect(result.workItem.remediationAttemptCount).toBe(1);
      expect(result.message).toMatch(/remediation/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-spec route moves work item back to grill", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-noroute-"));
    try {
      const item = upsertWorkItem(dir, {
        ...createWorkItem("feat-respec"),
        stage: "staged",
        stagedPrNumber: 7,
      });

      const { runner } = createRecordingGhRunner();
      const result = await applyNoRoute({
        route: "re-spec",
        workItem: item,
        stateDir: dir,
        githubRepo: "org/repo",
        ghRunner: runner,
      });

      expect(result.workItem.stage).toBe("grill");
      expect(result.message).toMatch(/re-spec|grill|PRD/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("park route sets parked, drafts PR, and adds parked label", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-noroute-"));
    try {
      const item = upsertWorkItem(dir, {
        ...createWorkItem("feat-park"),
        stage: "staged",
        issueNumber: 99,
        stagedPrNumber: 12,
        stagedBranchName: "feature/feat-park-xyz",
      });

      const { runner, calls } = createRecordingGhRunner();
      const result = await applyNoRoute({
        route: "park",
        workItem: item,
        stateDir: dir,
        githubRepo: "org/repo",
        ghRunner: runner,
      });

      expect(result.workItem.stage).toBe("parked");
      expect(calls.some((c) => c.includes("ready") && c.includes("--undo"))).toBe(
        true,
      );
      expect(calls.some((c) => c.includes("--add-label") && c.includes("parked"))).toBe(
        true,
      );
      expect(calls.some((c) => c.includes("issue") && c.includes("edit"))).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("abandon route closes PR and marks work item abandoned", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-noroute-"));
    try {
      const item = upsertWorkItem(dir, {
        ...createWorkItem("feat-abandon"),
        stage: "staged",
        stagedPrNumber: 3,
      });

      const { runner, calls } = createRecordingGhRunner();
      const result = await applyNoRoute({
        route: "abandon",
        workItem: item,
        stateDir: dir,
        githubRepo: "org/repo",
        ghRunner: runner,
      });

      expect(result.workItem.stage).toBe("abandoned");
      expect(calls.some((c) => c[0] === "pr" && c[1] === "close")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parked work item resumes via resume #N", async () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-noroute-"));
    try {
      const item = upsertWorkItem(dir, {
        ...createWorkItem("feat-resume"),
        stage: "parked",
        issueNumber: 55,
        stagedPrNumber: 20,
        stagedBranchName: "feature/feat-resume-aaa",
      });

      const loaded = getWorkItem(dir, item.slug);
      expect(loaded?.stage).toBe("parked");
      expect(loaded?.stagedPrNumber).toBe(20);
      expect(loaded?.stagedBranchName).toBe("feature/feat-resume-aaa");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
