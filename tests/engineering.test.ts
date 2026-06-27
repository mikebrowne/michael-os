import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "../src/skills/skillLoader.js";
import {
  createWorkItem,
  upsertWorkItem,
  getWorkItem,
  listInProgressWorkItems,
} from "../src/engineering/workItem.js";
import {
  buildCreateIssueCommand,
  parseIssueNumberFromCreateOutput,
} from "../src/engineering/github.js";
import {
  createGatewayMemorySession,
  gatewayMemoryOptions,
} from "../src/engineering/gatewaySession.js";
import {
  createApprovalState,
  grantApproval,
  consumeApproval,
  requestApproval,
  isDangerousTool,
  parseYesNo,
} from "../src/engineering/approvalGate.js";
import {
  filterImplementationFiles,
  assertBuildGreenForShip,
} from "../src/engineering/ship.js";
import { formatBuildChatReport } from "../src/engineering/report.js";
import { evaluateRedGreenGates } from "../src/agentBuild/gates.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("gatewaySession", () => {
  it("creates stable memory options for a session", () => {
    const session = createGatewayMemorySession();
    const opts = gatewayMemoryOptions(session);
    expect(opts.memory.thread).toBe(session.threadId);
    expect(opts.memory.resource).toBe("operator");
  });
});

describe("skillLoader", () => {
  it("parses SKILL.md frontmatter", () => {
    const raw = `---
name: test-skill
description: A test skill
---
# Body

Do the thing.`;
    const skill = parseSkillMarkdown(raw);
    expect(skill.name).toBe("test-skill");
    expect(skill.description).toBe("A test skill");
    expect(skill.body).toContain("Do the thing");
  });
});

describe("workItem", () => {
  it("creates and persists work items", () => {
    const dir = mkdtempSync(join(tmpdir(), "michael-os-wi-"));
    try {
      const item = createWorkItem("Add greet utility");
      upsertWorkItem(dir, item);
      const loaded = getWorkItem(dir, item.slug);
      expect(loaded?.title).toBe("Add greet utility");
      expect(listInProgressWorkItems(dir)).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("github", () => {
  it("builds gh issue create command", () => {
    const cmd = buildCreateIssueCommand("owner/repo", {
      title: "Test",
      body: "Body",
      labels: ["spec-wip"],
    });
    expect(cmd[0]).toBe("gh");
    expect(cmd).toContain("issue");
    expect(cmd).toContain("create");
  });

  it("parses issue number from gh output", () => {
    const num = parseIssueNumberFromCreateOutput(
      "https://github.com/owner/repo/issues/42",
    );
    expect(num).toBe(42);
  });
});

describe("approvalGate", () => {
  it("identifies dangerous tools", () => {
    expect(isDangerousTool("run-build")).toBe(true);
    expect(isDangerousTool("save-prd")).toBe(false);
  });

  it("grants one-shot approval", () => {
    const state = createApprovalState();
    requestApproval(state, "run-build");
    grantApproval(state);
    expect(consumeApproval(state, "run-build")).toBe(true);
    expect(consumeApproval(state, "run-build")).toBe(false);
  });

  it("parses yes/no", () => {
    expect(parseYesNo("YES")).toBe("yes");
    expect(parseYesNo("no")).toBe("no");
    expect(parseYesNo("maybe")).toBeNull();
  });
});

describe("ship", () => {
  it("filters acceptance tests from implementation files", () => {
    const files = filterImplementationFiles([
      "src/utils/greet.ts",
      "tests/acceptance/agent-build.test.ts",
    ]);
    expect(files).toEqual(["src/utils/greet.ts"]);
  });

  it("rejects ship when build is not green", () => {
    const buildResult = {
      success: false,
      runId: "r1",
      runDir: "/tmp",
      resultPath: "/tmp/result.md",
      worktreePath: "/tmp/wt",
      request: "x",
      specSummary: "",
      changedFiles: [],
      gitDiff: "",
      markdown: "",
      cursorResult: { started: true, status: "finished" as const, summary: "" },
      gateOutcome: evaluateRedGreenGates(
        { passed: false, exitCode: 1, log: "" },
        { passed: false, exitCode: 1, log: "" },
        true,
      ),
      preflight: { passed: false, steps: [], log: "" },
    } satisfies import("../src/agentBuild/runAgentBuild.js").RunAgentBuildResult;

    expect(() => assertBuildGreenForShip(buildResult, true)).toThrow(/not green/);
  });
});

describe("report", () => {
  it("formats green build report with push prompt", () => {
    const result = {
      success: true,
      request: "Add greet",
      runDir: "/tmp/run",
      changedFiles: ["src/utils/greet.ts"],
      gitDiff: "diff content",
      cursorResult: { started: true, status: "finished" as const, summary: "ok" },
      gateOutcome: evaluateRedGreenGates(
        { passed: false, exitCode: 1, log: "" },
        { passed: true, exitCode: 0, log: "" },
        true,
      ),
      preflight: {
        passed: true,
        steps: [{ script: "test", ran: true, passed: true, skipped: false, output: "" }],
        log: "",
      },
    } as import("../src/agentBuild/runAgentBuild.js").RunAgentBuildResult;

    const report = formatBuildChatReport(result);
    expect(report.success).toBe(true);
    expect(report.canPromptPush).toBe(true);
    expect(report.body).toContain("push");
  });

  it("formats red build without push prompt", () => {
    const result = {
      success: false,
      runId: "r1",
      runDir: "/tmp/run",
      resultPath: "/tmp/result.md",
      worktreePath: "/tmp/wt",
      specSummary: "",
      markdown: "",
      request: "Add greet",
      changedFiles: [],
      gitDiff: "",
      cursorResult: {
        started: false,
        status: "not_started" as const,
        summary: "failed",
        startupError: "boom",
      },
      gateOutcome: evaluateRedGreenGates(
        { passed: false, exitCode: 1, log: "" },
        { passed: false, exitCode: 1, log: "" },
        true,
      ),
      preflight: { passed: false, steps: [], log: "" },
    } satisfies import("../src/agentBuild/runAgentBuild.js").RunAgentBuildResult;

    const report = formatBuildChatReport(result);
    expect(report.canPromptPush).toBe(false);
    expect(report.body).toContain("boom");
  });
});
