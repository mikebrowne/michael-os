import { describe, expect, it } from "vitest";
import {
  formatBuildListLine,
} from "../src/agentBuild/buildVisibility.js";
import type { BuildSessionRecord } from "../src/agentBuild/buildChecklist.js";

describe("buildVisibility", () => {
  it("formats build list line", () => {
    const session: BuildSessionRecord = {
      id: "s1",
      slug: "feat",
      agentId: "agent-12345678",
      worktreePath: "/tmp/wt",
      runDir: "/tmp/run",
      planMarkdown: "",
      slices: [
        { id: "1", title: "A", status: "completed" },
        { id: "2", title: "B", status: "pending" },
      ],
      currentSliceIndex: 1,
      status: "building",
      clarifyingRounds: 0,
      acceptanceRelativePath: "tests/acceptance/agent-build.test.ts",
      createdAt: "",
      updatedAt: "",
    };
    const line = formatBuildListLine(session);
    expect(line).toContain("feat");
    expect(line).toContain("slices 1/2");
  });
});
