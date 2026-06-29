import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
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
import { stageBuild, promoteStagedChange, rollbackPromotion } from "../../../engineering/staging.js";
import {
  executeControlledRestart,
  promotionTouchesHarness,
} from "../../../gateway/restart.js";
import { requireOpenAiKey, requireCursorKey } from "../../../config/loadConfig.js";
import { createRunLogger } from "../../../logging/runLogger.js";
import { randomUUID } from "node:crypto";
import {
  formatBuildVerificationReport,
  canPromoteWithVerdict,
  assertAllGatesPresent,
  REQUIRED_FULL_GATES,
} from "../../../engineering/buildVerification.js";
import { runBuildVerification } from "../../../engineering/buildVerificationRunner.js";
import {
  collectFailedFindings,
  createRemediationState,
  isRemediationCapReached,
  recordRemediationAttempt,
  triageGateFindings,
  findingsToRemediationContext,
} from "../../../engineering/remediation.js";
import {
  runCodeReview,
  formatReviewVerdictReport,
} from "../../../engineering/review.js";
import {
  rehydrateBuildFromWorkItem,
  tryRehydrateBuildResult,
} from "../../../engineering/buildManifest.js";
import {
  runSteerablePlanPhase,
  runSteerableDispatchSlice,
  finalizeSteerableBuild,
  getSteerableBuildStatus,
} from "../../../agentBuild/steerableBuild.js";
import { buildSessionPath } from "../../../agentBuild/buildChecklist.js";

const DEFAULT_ACCEPTANCE_RELATIVE = "tests/acceptance/agent-build.test.ts";

type PlanBuildInput = { slug: string; operatorAnswer?: string; contextSummary?: string };
type DispatchSliceInput = {
  slug?: string;
  sliceIndex?: number;
  correctiveMessage?: string;
  targetedTestFiles?: string[];
  finalize?: boolean;
};

type RunBuildInput = { slug: string; requestSummary?: string };
type ShipDocsInput = { slug: string; commitMessage: string };
type ShipImplementationInput = { commitMessage: string };
type StageImplementationInput = { commitMessage: string; prBody?: string };
type PromoteInput = { commitMessage: string };
type RollbackInput = { promotionNumber: number };

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

  async function executeStageImplementationCore(input: StageImplementationInput) {
    const buildResult = tryRehydrateBuildResult(ctx);
    if (!buildResult || !isBuildGreen(buildResult)) {
      throw new Error(
        "Cannot stage implementation: no green build result in session. Rebuild if worktree expired.",
      );
    }
    ctx.lastBuildResult = buildResult;

    const item = ctx.currentWorkItem;
    if (!item) {
      throw new Error("No current work item to stage.");
    }

    const prBody =
      input.prBody ??
      [
        item.prdPath ? `PRD: ${item.prdPath}` : "",
        item.acceptanceTestPath
          ? `Acceptance test: ${item.acceptanceTestPath}`
          : "",
        "Verification: pending",
      ]
        .filter(Boolean)
        .join("\n\n");

    const staged = await stageBuild(
      {
        repoPath: ctx.repoPath,
        worktreePath: buildResult.worktreePath,
        slug: item.slug,
        runId: buildResult.runId,
        title: item.title,
        prBody,
        commitMessage: input.commitMessage,
        changedFiles: buildResult.changedFiles,
        githubRepo: ctx.githubRepo,
      },
      ctx.gitRunner,
      ctx.ghRunner,
    );

    ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
      ...item,
      stage: "ship",
      lastBuildSuccess: true,
      stagedBranchName: staged.branchName,
      stagedPrNumber: staged.prNumber,
    });

    return {
      message: `Staged as PR #${staged.prNumber} on branch ${staged.branchName}. Files: ${staged.stagedFiles.join(", ")}`,
      staged: true,
      prNumber: staged.prNumber,
      branchName: staged.branchName,
    };
  }

  async function executePromoteCore(input: PromoteInput) {
    const buildResult = tryRehydrateBuildResult(ctx);
    const item = ctx.currentWorkItem;
    if (!buildResult || !item) {
      throw new Error("Cannot promote: missing green build or work item.");
    }

    if (!ctx.lastBuildVerificationVerdict || ctx.lastBuildVerificationVerdict.overall !== "pass") {
      throw new Error("Cannot promote: build verification must pass first (or override gates).");
    }
    if (!item.stagedBranchName || item.stagedPrNumber == null) {
      throw new Error("Cannot promote: work item has no staged PR. Run stage-implementation first.");
    }

    const promotion = await promoteStagedChange(
      {
        repoPath: ctx.repoPath,
        githubRepo: ctx.githubRepo,
        branchName: item.stagedBranchName,
        prNumber: item.stagedPrNumber,
        parentWorkItem: item.slug,
        issueNumber: item.issueNumber,
        commitMessage: input.commitMessage,
      },
      ctx.gitRunner,
      ctx.ghRunner,
      ctx.promotionRegistry,
    );

    ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
      ...item,
      stage: "done",
    });

    ctx.telemetry.logShipDecision(true, "promote");

    let message = `Promoted as #${promotion.promotionNumber} (commit ${promotion.commitSha.slice(0, 8)})`;
    if (promotionTouchesHarness(buildResult.changedFiles)) {
      message +=
        "\n\nThis promotion touched src/** — operator should restart the harness (`restart` command) after approval.";
    }

    return {
      message,
      promoted: true,
      promotionNumber: promotion.promotionNumber,
      commitSha: promotion.commitSha,
      suggestRestart: promotionTouchesHarness(buildResult.changedFiles),
    };
  }

  async function executeRestartCore() {
    const markerPath = join(ctx.config.mastraDir, "restart-marker.json");
    await executeControlledRestart({
      restartGate: ctx.restartGate,
      persistState: () => {
        mkdirSync(ctx.config.mastraDir, { recursive: true });
        writeFileSync(
          markerPath,
          `${JSON.stringify({ drained: true, at: new Date().toISOString() }, null, 2)}\n`,
          "utf-8",
        );
      },
      flushTelemetry: async () => {
        await ctx.observability.close();
        await ctx.jobRegistry.close();
        await ctx.promotionRegistry.close();
      },
      getHeadCommitSha: () => {
        const result = ctx.gitRunner(["git", "rev-parse", "HEAD"]);
        if (result.exitCode !== 0) return "unknown";
        return result.stdout.trim();
      },
      exitProcess: (code) => {
        process.exit(code);
      },
    });

    return { message: "Restart initiated.", restarting: true };
  }

  async function executeRollbackCore(input: RollbackInput) {
    const updated = await rollbackPromotion(
      {
        repoPath: ctx.repoPath,
        promotionNumber: input.promotionNumber,
      },
      ctx.gitRunner,
      ctx.promotionRegistry,
    );

    ctx.telemetry.logShipDecision(false, "rollback");

    return {
      message: `Rolled back promotion #${updated.promotionNumber} (revert ${updated.revertCommitSha?.slice(0, 8) ?? "unknown"})`,
      rolledBack: true,
      promotionNumber: updated.promotionNumber,
      revertCommitSha: updated.revertCommitSha,
    };
  }

  async function executeShipImplementationCore(input: ShipImplementationInput) {
    const buildResult = tryRehydrateBuildResult(ctx);
    if (!buildResult || !isBuildGreen(buildResult)) {
      throw new Error(
        "Cannot ship implementation: no green build result in session. Rebuild if worktree expired.",
      );
    }
    ctx.lastBuildResult = buildResult;

    const slug = ctx.currentWorkItem?.slug;
    if (slug) {
      const hasReview = await ctx.jobRegistry.hasReviewJobForWorkItem(
        slug,
        buildResult.acceptanceHash,
      );
      if (!hasReview) {
        ctx.telemetry.logReviewMissing(slug, ctx.currentWorkItem?.issueNumber);
      }
    }

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

  async function executeReviewBuildCore(slug: string) {
    const buildResult = tryRehydrateBuildResult(ctx);
    if (!buildResult || !isBuildGreen(buildResult)) {
      throw new Error("No green build to review. Run build first.");
    }

    const item = getWorkItem(ctx.config.stateDir, slug);
    if (!item?.prdPath || !item.acceptanceTestPath) {
      throw new Error("Work item missing PRD or acceptance test for review.");
    }

    requireOpenAiKey(ctx.config);
    ctx.telemetry.logAgentInvoked(
      "qa-engineer",
      "QA Engineer",
      ctx.config.defaultReviewModel,
    );

    const prdMarkdown = readFileSync(item.prdPath, "utf-8");
    const acceptanceTest = readFileSync(item.acceptanceTestPath, "utf-8");

    const runReview = async () =>
      runCodeReview(ctx.qaEngineerAgent, {
        gitDiff: buildResult.gitDiff,
        prdMarkdown,
        acceptanceTest,
        changedFiles: buildResult.changedFiles,
      });

    let verdict;
    if (ctx.jobRunner) {
      const result = await ctx.jobRunner.runCodeReviewJob({
        parentWorkItem: slug,
        issueNumber: item.issueNumber,
        input: {
          workItemSlug: slug,
          issueNumber: item.issueNumber,
          buildRunDir: buildResult.runDir,
          acceptanceHash: buildResult.acceptanceHash,
        },
        executeReview: runReview,
      });
      verdict = result.verdict;
    } else {
      verdict = await runReview();
    }

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
  }

  async function executeVerifyBuildCore(slug: string) {
    const buildResult = tryRehydrateBuildResult(ctx);
    if (!buildResult || !isBuildGreen(buildResult)) {
      throw new Error("No green build to verify. Run build first.");
    }

    const item = getWorkItem(ctx.config.stateDir, slug);
    if (!item?.prdPath || !item.acceptanceTestPath) {
      throw new Error("Work item missing PRD or acceptance test for verification.");
    }

    requireOpenAiKey(ctx.config);
    ctx.telemetry.logAgentInvoked(
      "qa-engineer",
      "QA Engineer",
      ctx.config.defaultReviewModel,
    );

    const prdMarkdown = readFileSync(item.prdPath, "utf-8");
    const acceptanceTest = readFileSync(item.acceptanceTestPath, "utf-8");
    const attemptCount = item.remediationAttemptCount ?? 0;

    const runVerification = async () => {
      const verdict = await runBuildVerification({
        worktreePath: buildResult.worktreePath,
        codeReviewInput: {
          gitDiff: buildResult.gitDiff,
          prdMarkdown,
          acceptanceTest,
          changedFiles: buildResult.changedFiles,
        },
        agent: ctx.qaEngineerAgent,
        prNumber: item.stagedPrNumber,
        githubRepo: ctx.githubRepo,
        ghRunner: ctx.ghRunner,
      });
      assertAllGatesPresent(verdict, REQUIRED_FULL_GATES);
      return verdict;
    };

    let verdict;
    let jobId: string | undefined;
    if (ctx.jobRunner) {
      const result = await ctx.jobRunner.runBuildVerificationJob({
        parentWorkItem: slug,
        issueNumber: item.issueNumber,
        input: {
          workItemSlug: slug,
          issueNumber: item.issueNumber,
          buildRunDir: buildResult.runDir,
          acceptanceHash: buildResult.acceptanceHash,
          worktreePath: buildResult.worktreePath,
          remediationAttempt: attemptCount,
        },
        executeVerification: runVerification,
      });
      verdict = result.verdict;
      jobId = result.jobId;
    } else {
      verdict = await runVerification();
    }

    ctx.lastBuildVerificationVerdict = verdict;
    for (const gate of verdict.gates) {
      ctx.telemetry.logGateResult(gate.kind, gate.status, slug);
    }

    if (verdict.overall === "pass") {
      ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
        ...item,
        stage: "staged",
      });
      return {
        message: `${formatBuildVerificationReport(verdict)}\n\nReady for promotion decision.`,
        overall: verdict.overall,
        jobId,
        canPromote: true,
      };
    }

    const triage = triageGateFindings(verdict.gates);
    const findings = collectFailedFindings(verdict.gates);
    const remediation = recordRemediationAttempt(
      createRemediationState(ctx.config.remediationCap),
      findings,
    );
    remediation.attemptCount = attemptCount + 1;
    remediation.lastFindings = findings;

    if (triage === "escalate-spec") {
      return {
        message: `${formatBuildVerificationReport(verdict)}\n\nSpec/requirements gap — escalate for re-PRD.`,
        overall: verdict.overall,
        triage,
        canPromote: false,
      };
    }

    if (triage === "surface-security") {
      return {
        message: `${formatBuildVerificationReport(verdict)}\n\nSecurity/permission findings surfaced to operator.`,
        overall: verdict.overall,
        triage,
        canPromote: false,
      };
    }

    if (isRemediationCapReached(remediation)) {
      ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
        ...item,
        stage: "blocked",
        remediationAttemptCount: remediation.attemptCount,
      });
      return {
        message: `${formatBuildVerificationReport(verdict)}\n\nRemediation cap (${ctx.config.remediationCap}) reached — work item blocked. Escalate to operator.`,
        overall: verdict.overall,
        blocked: true,
        attemptCount: remediation.attemptCount,
        findingsContext: findingsToRemediationContext(findings),
        canPromote: false,
      };
    }

    ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
      ...item,
      stage: "staged",
      remediationAttemptCount: remediation.attemptCount,
    });

    return {
      message: `${formatBuildVerificationReport(verdict)}\n\nRemediation attempt ${remediation.attemptCount}/${ctx.config.remediationCap}. Findings:\n${findingsToRemediationContext(findings)}`,
      overall: verdict.overall,
      attemptCount: remediation.attemptCount,
      findingsContext: findingsToRemediationContext(findings),
      canPromote: canPromoteWithVerdict(verdict),
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

  const planBuild = createTool({
    id: "plan-build",
    description:
      "Run plan-mode on a durable Cursor session; capture createPlan checklist before coding. Requires operator approval.",
    inputSchema: z.object({
      slug: z.string(),
      operatorAnswer: z.string().optional(),
      contextSummary: z.string().optional(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      needsOperatorInput: z.boolean().optional(),
      question: z.string().optional(),
      message: z.string(),
      sliceCount: z.number().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "plan-build")) {
        requestApproval(ctx.approval, "plan-build", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("plan-build"),
        };
      }

      const item = getWorkItem(ctx.config.stateDir, input.slug);
      if (!item?.prdPath || !item.acceptanceTestPath) {
        throw new Error("Work item missing PRD or acceptance test.");
      }

      requireCursorKey(ctx.config);
      const runLogger = createRunLogger({
        logDir: ctx.config.logDir,
        logLevel: ctx.config.logLevel,
        name: ctx.config.appName,
      });

      const result = await runSteerablePlanPhase({
        config: ctx.config,
        repoPath: ctx.repoPath,
        input: {
          slug: input.slug,
          prdMarkdown: readFileSync(item.prdPath, "utf-8"),
          acceptanceTestContent: readFileSync(item.acceptanceTestPath, "utf-8"),
          contextSummary: input.contextSummary,
        },
        observability: ctx.observability,
        runLogger,
        operatorAnswer: input.operatorAnswer,
      });

      if (!result.ok && result.needsOperatorInput) {
        return {
          needsOperatorInput: true,
          question: result.question,
          message: `Plan mode needs operator input:\n${result.question}`,
        };
      }

      if (!result.ok) {
        return { message: result.error ?? "Plan phase failed." };
      }

      ctx.activeBuildSession = result.session;
      ctx.currentWorkItem = upsertWorkItem(ctx.config.stateDir, {
        ...item,
        stage: "build",
        cursorAgentId: result.session.agentId,
        buildSessionPath: buildSessionPath(ctx.config.stateDir, input.slug),
        buildPlanPath: join(result.session.runDir, "build-plan.md"),
      });

      return {
        message: result.message,
        sliceCount: result.session.slices.length,
      };
    },
  });

  const dispatchSlice = createTool({
    id: "dispatch-slice",
    description:
      "Dispatch one bounded implementation slice on the durable build session. Requires operator approval unless session pre-authorized.",
    inputSchema: z.object({
      slug: z.string().optional(),
      sliceIndex: z.number().optional(),
      correctiveMessage: z.string().optional(),
      targetedTestFiles: z.array(z.string()).optional(),
      finalize: z.boolean().optional(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      allSlicesComplete: z.boolean().optional(),
      success: z.boolean().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "dispatch-slice")) {
        requestApproval(ctx.approval, "dispatch-slice", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("dispatch-slice"),
        };
      }

      const slug = input.slug ?? ctx.currentWorkItem?.slug;
      if (!slug) throw new Error("No work item slug for dispatch-slice.");

      requireCursorKey(ctx.config);
      const runLogger = createRunLogger({
        logDir: ctx.config.logDir,
        logLevel: ctx.config.logLevel,
        name: ctx.config.appName,
      });

      const dispatch = await runSteerableDispatchSlice({
        config: ctx.config,
        slug,
        observability: ctx.observability,
        runLogger,
        sliceIndex: input.sliceIndex,
        correctiveMessage: input.correctiveMessage,
        targetedTestFiles: input.targetedTestFiles,
      });

      if (!dispatch.ok) {
        return { message: dispatch.error };
      }

      ctx.activeBuildSession = dispatch.session;

      if (input.finalize && dispatch.allSlicesComplete) {
        const finalized = await finalizeSteerableBuild({
          config: ctx.config,
          slug,
          observability: ctx.observability,
        });
        ctx.activeBuildSession = null;
        return {
          message: `${dispatch.message}\n\n${finalized.message}`,
          allSlicesComplete: true,
          success: finalized.success,
        };
      }

      return {
        message: dispatch.message,
        allSlicesComplete: dispatch.allSlicesComplete,
      };
    },
  });

  const buildStatus = createTool({
    id: "build-status",
    description: "Show status of the active steerable build session for a work item.",
    inputSchema: z.object({
      slug: z.string().optional(),
    }),
    outputSchema: z.object({
      message: z.string(),
    }),
    execute: async (input) => {
      const slug = input.slug ?? ctx.currentWorkItem?.slug;
      if (!slug) throw new Error("No work item slug for build-status.");
      return { message: getSteerableBuildStatus(ctx.config, slug) };
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

  const verifyBuild = createTool({
    id: "verify-build",
    description:
      "Run build-verification gates (CI + code review) via QA Engineer. Returns composite verdict.",
    inputSchema: z.object({
      slug: z.string().optional(),
    }),
    outputSchema: z.object({
      message: z.string(),
      overall: z.string().optional(),
      canPromote: z.boolean().optional(),
      blocked: z.boolean().optional(),
      attemptCount: z.number().optional(),
    }),
    execute: async (input) => {
      const slug = input.slug ?? ctx.currentWorkItem?.slug;
      if (!slug) {
        throw new Error("No work item slug for verification.");
      }
      return executeVerifyBuildCore(slug);
    },
  });

  const reviewBuild = createTool({
    id: "review-build",
    description:
      "Run advisory code review on the last green build (PRD + diff + acceptance test). Delegates as a tracked Job.",
    inputSchema: z.object({
      slug: z.string().optional(),
    }),
    outputSchema: z.object({
      message: z.string(),
      decision: z.string().optional(),
      findingCount: z.number().optional(),
    }),
    execute: async (input) => {
      const slug = input.slug ?? ctx.currentWorkItem?.slug;
      if (!slug) {
        throw new Error("No work item slug for review.");
      }
      return executeReviewBuildCore(slug);
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
      "Deprecated: use stage-implementation then promote. Direct push to main is blocked.",
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

  const stageImplementationTool = createTool({
    id: "stage-implementation",
    description:
      "Stage green build as a feature branch + draft PR. Requires green build and operator approval.",
    inputSchema: z.object({
      commitMessage: z.string(),
      prBody: z.string().optional(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      staged: z.boolean().optional(),
      prNumber: z.number().optional(),
      branchName: z.string().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "stage-implementation")) {
        requestApproval(ctx.approval, "stage-implementation", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("stage-implementation"),
        };
      }
      return executeStageImplementationCore(input);
    },
  });

  const promoteTool = createTool({
    id: "promote",
    description:
      "Promote a staged PR to main after verification and operator approval.",
    inputSchema: z.object({
      commitMessage: z.string(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      promoted: z.boolean().optional(),
      promotionNumber: z.number().optional(),
      commitSha: z.string().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "promote")) {
        requestApproval(ctx.approval, "promote", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("promote"),
        };
      }
      return executePromoteCore(input);
    },
  });

  const rollbackTool = createTool({
    id: "rollback",
    description:
      "Revert a promoted change by promotion number. Requires operator approval.",
    inputSchema: z.object({
      promotionNumber: z.number(),
    }),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      rolledBack: z.boolean().optional(),
      promotionNumber: z.number().optional(),
      revertCommitSha: z.string().optional(),
    }),
    execute: async (input) => {
      if (!consumeApproval(ctx.approval, "rollback")) {
        requestApproval(ctx.approval, "rollback", input as Record<string, unknown>);
        return {
          needsApproval: true,
          message: needsApprovalMessage("rollback"),
        };
      }
      return executeRollbackCore(input);
    },
  });

  const restartTool = createTool({
    id: "restart",
    description:
      "Drain in-flight jobs, persist state, and restart the harness. Requires operator approval.",
    inputSchema: z.object({}),
    outputSchema: z.object({
      needsApproval: z.boolean().optional(),
      message: z.string(),
      restarting: z.boolean().optional(),
    }),
    execute: async () => {
      if (!consumeApproval(ctx.approval, "restart")) {
        requestApproval(ctx.approval, "restart", {});
        return {
          needsApproval: true,
          message: needsApprovalMessage("restart"),
        };
      }
      return executeRestartCore();
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
    if (toolId === "plan-build") {
      return planBuild.execute!(args as PlanBuildInput, {} as never) as Promise<
        Record<string, unknown>
      >;
    }
    if (toolId === "dispatch-slice") {
      return dispatchSlice.execute!(args as DispatchSliceInput, {} as never) as Promise<
        Record<string, unknown>
      >;
    }
    if (toolId === "ship-docs") {
      return executeShipDocsCore(args as ShipDocsInput);
    }
    if (toolId === "ship-implementation") {
      return executeShipImplementationCore(args as ShipImplementationInput);
    }
    if (toolId === "stage-implementation") {
      return executeStageImplementationCore(args as StageImplementationInput);
    }
    if (toolId === "promote") {
      return executePromoteCore(args as PromoteInput);
    }
    if (toolId === "rollback") {
      return executeRollbackCore(args as RollbackInput);
    }
    if (toolId === "restart") {
      return executeRestartCore();
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
    planBuild,
    dispatchSlice,
    buildStatus,
    runBuild,
    verifyBuild,
    reviewBuild,
    shipDocsTool,
    shipImplementationTool,
    stageImplementationTool,
    promoteTool,
    rollbackTool,
    restartTool,
    replayDangerousTool,
  };
}
