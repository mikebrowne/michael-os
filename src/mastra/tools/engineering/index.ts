import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import type { EngineeringSessionContext } from "../../../engineering/sessionContext.js";
import {
  createWorkItem,
  ensurePrdsDir,
  prdPaths,
  upsertWorkItem,
  listInProgressWorkItems,
  getWorkItem,
  getWorkItemByIssue,
} from "../../../engineering/workItem.js";
import { createIssue, updateIssueBody } from "../../../engineering/github.js";
import { runAgentBuild, isBuildGreen } from "../../../agentBuild/runAgentBuild.js";
import { formatBuildChatReport } from "../../../engineering/report.js";
import {
  consumeApproval,
  needsApprovalMessage,
  requestApproval,
  grantApproval,
} from "../../../engineering/approvalGate.js";
import { shipDocs, shipImplementation } from "../../../engineering/ship.js";
import { requireOpenAiKey, requireCursorKey } from "../../../config/loadConfig.js";
import { createRunLogger } from "../../../logging/runLogger.js";
import { randomUUID } from "node:crypto";
import {
  runCodeReview,
  formatReviewVerdictReport,
} from "../../../engineering/review.js";
import {
  rehydrateBuildFromWorkItem,
  tryRehydrateBuildResult,
} from "../../../engineering/buildManifest.js";

const DEFAULT_ACCEPTANCE_RELATIVE = "tests/acceptance/agent-build.test.ts";

type RunBuildInput = { slug: string; requestSummary?: string };
type ShipDocsInput = { slug: string; commitMessage: string };
type ShipImplementationInput = { commitMessage: string };

export function createEngineeringTools(ctx: EngineeringSessionContext) {
  async function executeRunBuildCore(input: RunBuildInput) {
    const item = getWorkItem(ctx.config.stateDir, input.slug);
    if (!item?.prdPath || !item.acceptanceTestPath) {
      throw new Error("Work item missing PRD or acceptance test artifacts.");
    }

    const prdMd = readFileSync(item.prdPath, "utf-8");
    const acceptanceTestContent = readFileSync(item.acceptanceTestPath, "utf-8");
    const cursorTaskMd = `Read spec.md in the run folder. Implement only the requested scope from the PRD below. NEVER modify tests/acceptance/agent-build.test.ts. Use the tdd skill for unit tests.\n\n${prdMd}`;

    requireOpenAiKey(ctx.config);
    requireCursorKey(ctx.config);

    const runLogger = createRunLogger({
      logDir: ctx.config.logDir,
      logLevel: ctx.config.logLevel,
      name: ctx.config.appName,
    });

    const result = await runAgentBuild({
      request: input.requestSummary ?? item.title,
      config: ctx.config,
      repoPath: ctx.repoPath,
      runId: randomUUID(),
      runLogger,
      suppliedSpec: {
        specMd: prdMd,
        cursorTaskMd,
        acceptanceTestRelativePath: DEFAULT_ACCEPTANCE_RELATIVE,
        acceptanceTestContent,
      },
    });

    ctx.lastBuildResult = result;
    ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
      ...item,
      stage: "build",
      lastRunDir: result.runDir,
      lastBuildSuccess: result.success,
      manifestPath: result.manifestPath,
      acceptanceHash: result.acceptanceHash,
    });

    const report = formatBuildChatReport(result, ctx.lastReviewVerdict);
    return {
      message: `${report.headline}\n\n${report.body}`,
      success: result.success,
      runDir: result.runDir,
    };
  }

  async function executeShipDocsCore(input: ShipDocsInput) {
    const paths = prdPaths(ctx.config.prdsDir, input.slug);
    const toShip = [paths.prdPath, paths.grillNotesPath].filter((p) => existsSync(p));
    if (toShip.length === 0) {
      throw new Error("No planning docs found to ship.");
    }

    shipDocs(
      { repoPath: ctx.repoPath, files: toShip, message: input.commitMessage },
      ctx.gitRunner,
    );

    return { message: `Planning docs pushed for ${input.slug}.`, shipped: true };
  }

  async function executeShipImplementationCore(input: ShipImplementationInput) {
    const buildResult = tryRehydrateBuildResult(ctx);
    if (!buildResult || !isBuildGreen(buildResult)) {
      throw new Error(
        "Cannot ship implementation: no green build result in session. Rebuild if worktree expired.",
      );
    }
    ctx.lastBuildResult = buildResult;
    ctx.telemetry.logShipDecision(true, "ship-implementation");

    const shipped = shipImplementation(
      {
        repoPath: ctx.repoPath,
        worktreePath: buildResult.worktreePath,
        buildResult,
        message: input.commitMessage,
        operatorConfirmed: true,
      },
      ctx.gitRunner,
    );

    if (ctx.currentWorkItem) {
      ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
        ...ctx.currentWorkItem,
        stage: "done",
      });
    }

    return {
      message: `Implementation shipped: ${shipped.join(", ")}`,
      shipped: true,
    };
  }

  const saveGrillNotes = createTool({
    id: "save-grill-notes",
    description:
      "Save grill interview notes for the current work item to docs/prds/<slug>.grill.md",
    inputSchema: z.object({
      title: z.string().describe("Short feature title used for slug"),
      content: z.string().describe("Grill notes markdown"),
    }),
    outputSchema: z.object({
      slug: z.string(),
      path: z.string(),
      workItemId: z.string(),
    }),
    execute: async (input) => {
      ensurePrdsDir(ctx.config.prdsDir);
      const item = createWorkItem(input.title);
      const paths = prdPaths(ctx.config.prdsDir, item.slug);
      writeFileSync(paths.grillNotesPath, `${input.content.trim()}\n`, "utf-8");
      const saved = upsertWorkItem(ctx.config.stateDir, {
        ...item,
        stage: "grill",
        grillNotesPath: paths.grillNotesPath,
      });
      ctx.currentWorkItem = saved;
      return { slug: saved.slug, path: paths.grillNotesPath, workItemId: saved.id };
    },
  });

  const savePrd = createTool({
    id: "save-prd",
    description: "Save a PRD to docs/prds/<slug>.md for the current work item",
    inputSchema: z.object({
      title: z.string(),
      prdMarkdown: z.string(),
      issueNumber: z.number().optional(),
    }),
    outputSchema: z.object({
      slug: z.string(),
      path: z.string(),
      issueNumber: z.number().optional(),
    }),
    execute: async (input) => {
      ensurePrdsDir(ctx.config.prdsDir);
      const base = ctx.currentWorkItem ?? createWorkItem(input.title);
      const paths = prdPaths(ctx.config.prdsDir, base.slug);
      writeFileSync(paths.prdPath, `${input.prdMarkdown.trim()}\n`, "utf-8");
      const saved = upsertWorkItem(ctx.config.stateDir, {
        ...base,
        title: input.title,
        stage: "prd",
        prdPath: paths.prdPath,
        issueNumber: input.issueNumber ?? base.issueNumber,
      });
      ctx.currentWorkItem = saved;
      return {
        slug: saved.slug,
        path: paths.prdPath,
        issueNumber: saved.issueNumber,
      };
    },
  });

  const saveTestArtifacts = createTool({
    id: "save-test-artifacts",
    description:
      "Append test plan to PRD and save acceptance test content for handoff",
    inputSchema: z.object({
      slug: z.string(),
      testPlanMarkdown: z.string(),
      acceptanceTestContent: z.string(),
    }),
    outputSchema: z.object({
      acceptanceTestPath: z.string(),
      acceptanceTestRelativePath: z.string(),
    }),
    execute: async (input) => {
      const item = getWorkItem(ctx.config.stateDir, input.slug);
      if (!item?.prdPath) {
        throw new Error(`Work item ${input.slug} has no PRD yet.`);
      }
      const paths = prdPaths(ctx.config.prdsDir, input.slug);
      const prd = readFileSync(item.prdPath, "utf-8");
      const updated = `${prd.trim()}\n\n## Test Plan\n\n${input.testPlanMarkdown.trim()}\n`;
      writeFileSync(paths.prdPath, `${updated}\n`, "utf-8");
      writeFileSync(
        paths.acceptanceTestPath,
        `${input.acceptanceTestContent.trim()}\n`,
        "utf-8",
      );
      const saved = upsertWorkItem(ctx.config.stateDir, {
        ...item,
        stage: "tests",
        acceptanceTestPath: paths.acceptanceTestPath,
      });
      ctx.currentWorkItem = saved;
      return {
        acceptanceTestPath: paths.acceptanceTestPath,
        acceptanceTestRelativePath: DEFAULT_ACCEPTANCE_RELATIVE,
      };
    },
  });

  const githubCreateIssue = createTool({
    id: "github-create-issue",
    description: "Create a GitHub issue for the current PRD/work item",
    inputSchema: z.object({
      title: z.string(),
      body: z.string(),
      labels: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      issueNumber: z.number().optional(),
      urlHint: z.string(),
    }),
    execute: async (input) => {
      const result = await createIssue(ctx.ghRunner, ctx.githubRepo, {
        title: input.title,
        body: input.body,
        labels: input.labels,
      });
      if (ctx.currentWorkItem && result.issueNumber) {
        ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
          ...ctx.currentWorkItem,
          issueNumber: result.issueNumber,
        });
      }
      return {
        issueNumber: result.issueNumber,
        urlHint: result.issueNumber
          ? `https://github.com/${ctx.githubRepo}/issues/${result.issueNumber}`
          : result.stdout,
      };
    },
  });

  const githubUpdateIssue = createTool({
    id: "github-update-issue",
    description: "Update an existing GitHub issue body",
    inputSchema: z.object({
      issueNumber: z.number(),
      body: z.string(),
    }),
    outputSchema: z.object({ updated: z.boolean() }),
    execute: async (input) => {
      await updateIssueBody(ctx.ghRunner, ctx.githubRepo, input.issueNumber, input.body);
      return { updated: true };
    },
  });

  const listInProgress = createTool({
    id: "list-in-progress",
    description: "List work items that are not done or abandoned",
    inputSchema: z.object({}),
    outputSchema: z.object({
      items: z.array(
        z.object({
          slug: z.string(),
          title: z.string(),
          stage: z.string(),
          issueNumber: z.number().optional(),
        }),
      ),
    }),
    execute: async () => {
      const items = listInProgressWorkItems(ctx.config.stateDir).map(
        (i: { slug: string; title: string; stage: string; issueNumber?: number }) => ({
        slug: i.slug,
        title: i.title,
        stage: i.stage,
        issueNumber: i.issueNumber,
      }));
      return { items };
    },
  });

  const resumeWorkItem = createTool({
    id: "resume-work-item",
    description: "Load a work item by slug or GitHub issue number into the session",
    inputSchema: z.object({
      slug: z.string().optional(),
      issueNumber: z.number().optional(),
    }),
    outputSchema: z.object({
      found: z.boolean(),
      workItem: z
        .object({
          slug: z.string(),
          title: z.string(),
          stage: z.string(),
          issueNumber: z.number().optional(),
        })
        .optional(),
    }),
    execute: async (input) => {
      const item = input.issueNumber
        ? getWorkItemByIssue(ctx.config.stateDir, input.issueNumber)
        : input.slug
          ? getWorkItem(ctx.config.stateDir, input.slug)
          : undefined;
      if (!item) return { found: false };
      ctx.currentWorkItem = item;
      const rehydrated = rehydrateBuildFromWorkItem(ctx.repoPath, item);
      if (rehydrated) {
        ctx.lastBuildResult = rehydrated;
      }
      return {
        found: true,
        workItem: {
          slug: item.slug,
          title: item.title,
          stage: item.stage,
          issueNumber: item.issueNumber,
        },
      };
    },
  });

  const runBuild = createTool({
    id: "run-build",
    description:
      "Run the Cursor build pipeline with supplied PRD and acceptance test. Requires operator approval.",
    inputSchema: z.object({
      slug: z.string(),
      requestSummary: z.string().optional(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      success: z.boolean().optional(),
      runDir: z.string().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "run-build")) {
        requestApproval(ctx.approval, "run-build", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("run-build"),
        };
      }
      return executeRunBuildCore(input);
    },
  });

  const reviewBuild = createTool({
    id: "review-build",
    description:
      "Run advisory code review on the last green build (PRD + diff + acceptance test).",
    inputSchema: z.object({
      slug: z.string().optional(),
    }),
    outputSchema: z.object({
      message: z.string(),
      decision: z.string().optional(),
      findingCount: z.number().optional(),
    }),
    execute: async (input) => {
      const buildResult = tryRehydrateBuildResult(ctx);
      if (!buildResult || !isBuildGreen(buildResult)) {
        throw new Error("No green build to review. Run build first.");
      }

      const slug = input.slug ?? ctx.currentWorkItem?.slug;
      if (!slug) {
        throw new Error("No work item slug for review.");
      }
      const item = getWorkItem(ctx.config.stateDir, slug);
      if (!item?.prdPath || !item.acceptanceTestPath) {
        throw new Error("Work item missing PRD or acceptance test for review.");
      }

      requireOpenAiKey(ctx.config);
      ctx.telemetry.logAgentInvoked(
        "code-reviewer",
        "Code Reviewer",
        ctx.config.defaultReviewModel,
      );

      const verdict = await runCodeReview(ctx.codeReviewerAgent, {
        gitDiff: buildResult.gitDiff,
        prdMarkdown: readFileSync(item.prdPath, "utf-8"),
        acceptanceTest: readFileSync(item.acceptanceTestPath, "utf-8"),
        changedFiles: buildResult.changedFiles,
      });

      ctx.lastReviewVerdict = verdict;
      ctx.telemetry.logReviewVerdict(
        verdict.decision,
        verdict.findings.length,
      );

      const report = formatReviewVerdictReport(verdict);
      const buildReport = formatBuildChatReport(buildResult, verdict);
      return {
        message: `${report}\n\n--- Build summary ---\n${buildReport.headline}\n${buildReport.body}`,
        decision: verdict.decision,
        findingCount: verdict.findings.length,
      };
    },
  });

  const shipDocsTool = createTool({
    id: "ship-docs",
    description:
      "Commit and push planning docs (PRD/grill notes) to main. Requires operator approval.",
    inputSchema: z.object({
      slug: z.string(),
      commitMessage: z.string(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      shipped: z.boolean().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "ship-docs")) {
        requestApproval(ctx.approval, "ship-docs", input as Record<string, unknown>);
        return { needsApproval: true, message: needsApprovalMessage("ship-docs") };
      }
      return executeShipDocsCore(input);
    },
  });

  const shipImplementationTool = createTool({
    id: "ship-implementation",
    description:
      "Push green build implementation from worktree to main. Requires green build and operator approval.",
    inputSchema: z.object({
      commitMessage: z.string(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      shipped: z.boolean().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "ship-implementation")) {
        requestApproval(ctx.approval, "ship-implementation", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("ship-implementation"),
        };
      }
      return executeShipImplementationCore(input);
    },
  });

  async function replayDangerousTool(): Promise<Record<string, unknown>> {
    const pending = ctx.approval.pending;
    if (!pending) {
      throw new Error("No pending dangerous tool to replay.");
    }
    const { toolId, args } = pending;
    grantApproval(ctx.approval, toolId);

    if (toolId === "run-build") {
      return executeRunBuildCore(args as RunBuildInput);
    }
    if (toolId === "ship-docs") {
      return executeShipDocsCore(args as ShipDocsInput);
    }
    if (toolId === "ship-implementation") {
      return executeShipImplementationCore(args as ShipImplementationInput);
    }
    throw new Error(`Unknown dangerous tool: ${toolId}`);
  }

  return {
    saveGrillNotes,
    savePrd,
    saveTestArtifacts,
    githubCreateIssue,
    githubUpdateIssue,
    listInProgress,
    resumeWorkItem,
    runBuild,
    reviewBuild,
    shipDocsTool,
    shipImplementationTool,
    replayDangerousTool,
  };
}
