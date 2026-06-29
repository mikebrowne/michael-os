import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parsePlanSlices,
  saveBuildSession,
  loadBuildSession,
  formatBuildSessionSummary,
} from "../src/agentBuild/buildChecklist.js";

describe("buildChecklist", () => {
  it("parses markdown checklist items into slices", () => {
    const plan = `## Plan
- [ ] Add durable executor
- [ ] Wire plan-build tool
1. Finalize acceptance`;
    const slices = parsePlanSlices(plan);
    expect(slices).toHaveLength(3);
    expect(slices[0]?.title).toBe("Add durable executor");
    expect(slices[2]?.id).toBe("slice-3");
  });

  it("falls back to single slice when no bullets found", () => {
    const slices = parsePlanSlices("Implement the feature end to end.");
    expect(slices).toHaveLength(1);
    expect(slices[0]?.title).toBe("Implement approved plan");
  });

  it("persists and loads build session records", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-build-session-"));
    try {
      const saved = saveBuildSession(dir, {
        id: "sess-1",
        slug: "feat",
        agentId: "agent-1",
        worktreePath: "/tmp/wt",
        runDir: "/tmp/run",
        planMarkdown: "- [ ] Slice A",
        slices: [{ id: "slice-1", title: "Slice A", status: "pending" }],
        currentSliceIndex: 0,
        status: "planned",
        clarifyingRounds: 0,
        acceptanceRelativePath: "tests/acceptance/agent-build.test.ts",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(existsSync(join(dir, "build-sessions", "feat.json"))).toBe(true);
      const loaded = loadBuildSession(dir, "feat");
      expect(loaded?.agentId).toBe("agent-1");
      expect(formatBuildSessionSummary(saved)).toContain("Slices: 0/1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
