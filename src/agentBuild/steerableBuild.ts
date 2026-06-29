import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { AppConfig } from "../config/loadConfig.js";
import type { RunLogger } from "../logging/runLogger.js";
import { createRunDirectory } from "./runDir.js";
import {
  createWorktree,
  installDependencies,
  captureGitDiff,
  listChangedFiles,
} from "./worktree.js";
import {
  installAcceptanceTestInWorktree,
  normalizeAcceptanceImports,
} from "./generateSpec.js";
import {
  runAcceptanceTest,
  saveAcceptanceHash,
  verifyAcceptanceHash,
  evaluateRedGreenGates,
  lockAcceptanceTest,
  unlockAcceptanceTest,
} from "./gates.js";
import { runPreflight } from "./preflight.js";
import {
  createDurableCursorExecutor,
  parseStreamForPlan,
} from "./durableCodingExecutor.js";
import {
  type BuildSessionRecord,
  type BuildSlice,
  formatBuildSessionSummary,
  loadBuildSession,
  parsePlanSlices,
  saveBuildSession,
} from "./buildChecklist.js";
import { createBuildTelemetry, type BuildTelemetry } from "./buildTelemetry.js";
import { runSliceVerification } from "./sliceVerification.js";
import type { DurableRunHandle, DurableSession } from "./types.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { SDKMessage } from "@cursor/sdk";
import { buildStreamBus } from "./buildStreamBus.js";

const PLAN_PROMPT_PREFIX =
  "Do not write any code. Research the codebase and produce a reviewable implementation plan with a checklist. Make reasonable assumptions and state them if requirements are ambiguous.";

const DEFAULT_ACCEPTANCE_PATH = "tests/acceptance/agent-build.test.ts";
const MAX_CLARIFYING_ROUNDS = 1;

export type SteerableBuildPlanInput = {
  slug: string;
  prdMarkdown: string;
  acceptanceTestContent: string;
  acceptanceRelativePath?: string;
  contextSummary?: string;
};

export type SteerableBuildPlanResult =
  | {
      ok: true;
      session: BuildSessionRecord;
      needsOperatorInput?: false;
      message: string;
    }
  | {
      ok: false;
      needsOperatorInput: true;
      question: string;
      session?: BuildSessionRecord;
    }
  | {
      ok: false;
      needsOperatorInput?: false;
      error: string;
    };

export type SteerableBuildDispatchResult =
  | {
      ok: true;
      session: BuildSessionRecord;
      sliceVerifyPassed: boolean;
      allSlicesComplete: boolean;
      message: string;
    }
  | { ok: false; error: string };

export type SteerableBuildFinalizeResult = {
  success: boolean;
  session: BuildSessionRecord;
  gateOutcome: ReturnType<typeof evaluateRedGreenGates>;
  preflight: ReturnType<typeof runPreflight>;
  changedFiles: string[];
  gitDiff: string;
  message: string;
};

type ActiveSession = {
  record: BuildSessionRecord;
  durable: DurableSession;
};

const activeSessions = new Map<string, ActiveSession>();
const inFlightRuns = new Map<string, DurableRunHandle>();
const backgroundDispatchTasks = new Map<string, Promise<SteerableBuildDispatchResult>>();

export function isBuildInFlight(slug: string): boolean {
  return inFlightRuns.has(slug) || backgroundDispatchTasks.has(slug);
}

async function pumpRunStream(slug: string, run: DurableRunHandle): Promise<void> {
  try {
    for await (const message of run.stream()) {
      emitStreamMessage(slug, message);
    }
  } catch {
    // stream may end when run completes
  }
}

function emitStreamMessage(slug: string, message: SDKMessage): void {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text.trim()) {
        buildStreamBus.emitEvent({
          slug,
          kind: "progress",
          message: block.text.slice(0, 800),
        });
      }
    }
  }
  if (
    message.type === "tool_call" &&
    message.status === "completed" &&
    message.name === "updateTodos"
  ) {
    buildStreamBus.emitEvent({
      slug,
      kind: "todo",
      message: "Todos updated",
      data: { args: message.args },
    });
  }
}

async function waitRunWithStream(
  slug: string,
  run: DurableRunHandle,
): Promise<Awaited<ReturnType<DurableRunHandle["wait"]>>> {
  const pump = pumpRunStream(slug, run);
  const result = await run.wait();
  await pump.catch(() => undefined);
  return result;
}

export function getActiveSteerableSession(slug: string): ActiveSession | undefined {
  return activeSessions.get(slug);
}

export function setActiveSteerableSession(
  slug: string,
  record: BuildSessionRecord,
  durable: DurableSession,
): void {
  activeSessions.set(slug, { record, durable });
}

export function clearActiveSteerableSession(slug: string): void {
  const active = activeSessions.get(slug);
  active?.durable.close();
  activeSessions.delete(slug);
}

function looksLikeClarifyingQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    text.includes("?") &&
    (lower.includes("clarif") ||
      lower.includes("which") ||
      lower.includes("should i") ||
      lower.includes("do you want") ||
      lower.includes("please confirm"))
  );
}

function buildAutoAnswer(contextSummary?: string): string {
  const base =
    "Make reasonable assumptions based on the PRD and stated requirements. State each assumption explicitly in the plan. Do not ask further clarifying questions unless truly blocking.";
  return contextSummary ? `${base}\n\nContext:\n${contextSummary}` : base;
}

async function capturePlanFromRun(
  run: Awaited<ReturnType<DurableSession["send"]>>,
): Promise<{ planMarkdown?: string; assistantText: string }> {
  const [streamCapture, waitResult] = await Promise.all([
    parseStreamForPlan(run.stream()),
    run.wait(),
  ]);

  if (waitResult.status === "error" || waitResult.status === "cancelled") {
    throw new Error(waitResult.result ?? `Plan run ${waitResult.status}`);
  }

  return {
    planMarkdown: streamCapture.planMarkdown,
    assistantText: streamCapture.assistantText.join("\n"),
  };
}

export async function runSteerablePlanPhase(options: {
  config: AppConfig;
  repoPath: string;
  input: SteerableBuildPlanInput;
  observability: ObservabilityStore;
  runLogger?: RunLogger;
  operatorAnswer?: string;
}): Promise<SteerableBuildPlanResult> {
  const {
    config,
    repoPath,
    input,
    observability,
    runLogger,
    operatorAnswer,
  } = options;
  const acceptanceRelativePath =
    input.acceptanceRelativePath ?? DEFAULT_ACCEPTANCE_PATH;
  const telemetry = createBuildTelemetry(observability, runLogger);

  const paths = createRunDirectory(config.aiRunsDir, input.slug);
  const baseCommit = execSync("git rev-parse HEAD", {
    cwd: repoPath,
    encoding: "utf-8",
  }).trim();

  const worktreeInfo = createWorktree(repoPath, paths.worktreePath, paths.slug);
  void worktreeInfo;

  const acceptanceContent = normalizeAcceptanceImports(
    input.acceptanceTestContent,
  );
  installAcceptanceTestInWorktree(
    paths.worktreePath,
    acceptanceRelativePath,
    acceptanceContent,
  );
  const acceptanceHash = saveAcceptanceHash(
    join(paths.worktreePath, acceptanceRelativePath),
    paths.acceptanceHashPath,
  );
  lockAcceptanceTest(join(paths.worktreePath, acceptanceRelativePath));
  installDependencies(paths.worktreePath);

  writeFileSync(paths.specPath, `${input.prdMarkdown.trim()}\n`, "utf-8");
  writeFileSync(
    join(paths.runDir, "plan-context.md"),
    `${input.prdMarkdown.trim()}\n`,
    "utf-8",
  );

  const executor = createDurableCursorExecutor(config);
  const started = await executor.startSession({
    worktreePath: paths.worktreePath,
    runDir: paths.runDir,
    name: `plan-${input.slug}`,
    initialMode: "plan",
  });

  if (!started.ok) {
    return { ok: false, error: started.error };
  }

  const { session } = started;
  const sessionId = randomUUID();

  const existing = loadBuildSession(config.stateDir, input.slug);
  const clarifyingRounds = existing?.clarifyingRounds ?? 0;

  telemetry.logSessionStarted({
    slug: input.slug,
    agentId: session.agentId,
    worktreePath: paths.worktreePath,
  });

  const planPrompt = `${PLAN_PROMPT_PREFIX}\n\n## PRD\n\n${input.prdMarkdown}`;

  try {
    let planMarkdown: string | undefined;
    let assistantText = "";

    if (operatorAnswer) {
      const answerRun = await session.send({
        message: operatorAnswer,
        mode: "plan",
      });
      const captured = await capturePlanFromRun(answerRun);
      planMarkdown = captured.planMarkdown;
      assistantText = captured.assistantText;
    } else {
      const planRun = await session.send({ message: planPrompt, mode: "plan" });
      const captured = await capturePlanFromRun(planRun);
      planMarkdown = captured.planMarkdown;
      assistantText = captured.assistantText;

      if (!planMarkdown && looksLikeClarifyingQuestion(assistantText)) {
        telemetry.logClarification({
          slug: input.slug,
          round: clarifyingRounds + 1,
          auto: clarifyingRounds < MAX_CLARIFYING_ROUNDS,
        });

        if (clarifyingRounds >= MAX_CLARIFYING_ROUNDS) {
          const partial: BuildSessionRecord = {
            id: sessionId,
            slug: input.slug,
            agentId: session.agentId,
            worktreePath: paths.worktreePath,
            runDir: paths.runDir,
            planMarkdown: "",
            slices: [],
            currentSliceIndex: 0,
            status: "blocked",
            clarifyingRounds: clarifyingRounds + 1,
            acceptanceRelativePath,
            acceptanceHash,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          saveBuildSession(config.stateDir, partial);
          setActiveSteerableSession(input.slug, partial, session);
          return {
            ok: false,
            needsOperatorInput: true,
            question: assistantText,
            session: partial,
          };
        }

        const followUp = await session.send({
          message: buildAutoAnswer(input.contextSummary),
          mode: "plan",
        });
        const followCaptured = await capturePlanFromRun(followUp);
        planMarkdown = followCaptured.planMarkdown;
        assistantText = followCaptured.assistantText;
      }
    }

    if (!planMarkdown) {
      return {
        ok: false,
        error: `Plan mode did not emit createPlan. Assistant said: ${assistantText.slice(0, 500)}`,
      };
    }

    const slices = parsePlanSlices(planMarkdown);
    const record = saveBuildSession(config.stateDir, {
      id: sessionId,
      slug: input.slug,
      agentId: session.agentId,
      worktreePath: paths.worktreePath,
      runDir: paths.runDir,
      planMarkdown,
      slices,
      currentSliceIndex: 0,
      status: "planned",
      clarifyingRounds: operatorAnswer
        ? clarifyingRounds + 1
        : clarifyingRounds,
      acceptanceRelativePath,
      acceptanceHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    writeFileSync(
      join(paths.runDir, "build-plan.md"),
      `${planMarkdown.trim()}\n`,
      "utf-8",
    );

    telemetry.logPlanCaptured({
      slug: input.slug,
      agentId: session.agentId,
      sliceCount: slices.length,
      baseCommit,
    });

    setActiveSteerableSession(input.slug, record, session);

    return {
      ok: true,
      session: record,
      message: `Plan captured with ${slices.length} slice(s).\n\n${formatBuildSessionSummary(record)}`,
    };
  } catch (error: unknown) {
    session.close();
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runSteerableDispatchSlice(options: {
  config: AppConfig;
  slug: string;
  observability: ObservabilityStore;
  runLogger?: RunLogger;
  sliceIndex?: number;
  correctiveMessage?: string;
  targetedTestFiles?: string[];
}): Promise<SteerableBuildDispatchResult> {
  const {
    config,
    slug,
    observability,
    runLogger,
    sliceIndex,
    correctiveMessage,
    targetedTestFiles = [],
  } = options;

  const telemetry = createBuildTelemetry(observability, runLogger);
  let active = activeSessions.get(slug);
  let record = active?.record ?? loadBuildSession(config.stateDir, slug);

  if (!record) {
    return { ok: false, error: `No build session for slug ${slug}` };
  }

  if (!active) {
    const executor = createDurableCursorExecutor(config);
    const resumed = await executor.resumeSession(
      record.agentId,
      record.worktreePath,
    );
    if (!resumed.ok) {
      return { ok: false, error: resumed.error };
    }
    active = { record, durable: resumed.session };
    setActiveSteerableSession(slug, record, resumed.session);
    telemetry.logResumed({ slug, agentId: record.agentId });
  }

  const index = sliceIndex ?? record.currentSliceIndex;
  if (index >= record.slices.length) {
    return { ok: false, error: "All slices already dispatched." };
  }

  const slice = record.slices[index]!;
  record.status = "building";
  record.slices = record.slices.map((s, i) =>
    i === index ? { ...s, status: "inProgress" } : s,
  );
  record = saveBuildSession(config.stateDir, record);
  active.record = record;

  const buildPrompt = correctiveMessage
    ? correctiveMessage
    : [
        `Implement exactly this bounded slice from the approved plan.`,
        `Do not work on other slices.`,
        "",
        `## Slice`,
        slice.title,
        "",
        `## Full plan`,
        record.planMarkdown,
      ].join("\n");

  try {
    const run = await active.durable.send({
      message: buildPrompt,
      mode: "agent",
    });
    inFlightRuns.set(slug, run);
    buildStreamBus.emitEvent({
      slug,
      kind: "slice_started",
      message: `Slice ${index + 1}: ${slice.title}`,
    });

    const result = await waitRunWithStream(slug, run);
    inFlightRuns.delete(slug);

    if (result.status === "error" || result.status === "cancelled") {
      record.slices = record.slices.map((s, i) =>
        i === index ? { ...s, status: "failed" } : s,
      );
      record.status = "blocked";
      record = saveBuildSession(config.stateDir, record);
      return {
        ok: false,
        error: result.result ?? `Slice run ${result.status}`,
      };
    }

    telemetry.logSliceDispatched({
      slug,
      sliceId: slice.id,
      sliceIndex: index,
      runId: result.runId,
    });

    const verify = runSliceVerification(
      record.worktreePath,
      targetedTestFiles,
    );
    telemetry.logSliceVerified({
      slug,
      sliceId: slice.id,
      passed: verify.passed,
      steps: verify.steps.map((s) => s.name),
    });

    const nextSlices: BuildSlice[] = record.slices.map((s, i) => {
      if (i !== index) return s;
      return { ...s, status: verify.passed ? "completed" : "failed" };
    });

    const allComplete =
      verify.passed && index + 1 >= record.slices.length;
    const nextIndex = verify.passed ? index + 1 : index;

    record = saveBuildSession(config.stateDir, {
      ...record,
      slices: nextSlices,
      currentSliceIndex: nextIndex,
      status: allComplete ? "verifying" : verify.passed ? "building" : "blocked",
    });
    active.record = record;

    buildStreamBus.emitEvent({
      slug,
      kind: "slice_complete",
      message: verify.passed ? "Slice verify PASS" : "Slice verify FAIL",
    });

    return {
      ok: true,
      session: record,
      sliceVerifyPassed: verify.passed,
      allSlicesComplete: allComplete,
      message: [
        `Slice ${index + 1}/${record.slices.length}: ${slice.title}`,
        verify.passed ? "Slice verify: PASS" : "Slice verify: FAIL",
        verify.steps
          .filter((s) => !s.passed)
          .map((s) => `${s.name} failed`)
          .join("\n"),
        formatBuildSessionSummary(record),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  } catch (error: unknown) {
    inFlightRuns.delete(slug);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function startSteerableDispatchSliceBackground(
  options: Parameters<typeof runSteerableDispatchSlice>[0],
): { started: boolean; message: string } {
  const { slug } = options;
  if (backgroundDispatchTasks.has(slug) || inFlightRuns.has(slug)) {
    return {
      started: false,
      message: `Build for ${slug} already has an in-flight slice.`,
    };
  }

  const task = runSteerableDispatchSlice(options)
    .then((result) => {
      buildStreamBus.emitEvent({
        slug,
        kind: result.ok ? "slice_complete" : "error",
        message: result.ok ? result.message : (result.error ?? "dispatch failed"),
      });
      return result;
    })
    .finally(() => {
      backgroundDispatchTasks.delete(slug);
    });

  backgroundDispatchTasks.set(slug, task);
  buildStreamBus.emitEvent({
    slug,
    kind: "progress",
    message: "Slice dispatch started (non-blocking).",
  });

  return {
    started: true,
    message: "Slice dispatch started in background. Use build-status or watch stream output.",
  };
}

export async function interruptSteerableBuild(options: {
  config: AppConfig;
  slug: string;
  observability: ObservabilityStore;
  runLogger?: RunLogger;
  correctiveMessage?: string;
}): Promise<{ ok: boolean; message: string }> {
  const { slug, observability, runLogger, correctiveMessage, config } = options;
  const telemetry = createBuildTelemetry(observability, runLogger);
  const run = inFlightRuns.get(slug);

  if (run) {
    if (run.supports("cancel")) {
      await run.cancel();
    }
    inFlightRuns.delete(slug);
    telemetry.logInterrupted({ slug, reason: "operator" });
    buildStreamBus.emitEvent({
      slug,
      kind: "interrupted",
      message: "In-flight slice cancelled.",
    });
  } else {
    backgroundDispatchTasks.delete(slug);
    buildStreamBus.emitEvent({
      slug,
      kind: "interrupted",
      message: "Background dispatch cleared.",
    });
  }

  if (correctiveMessage) {
    const started = startSteerableDispatchSliceBackground({
      config,
      slug,
      observability,
      runLogger,
      correctiveMessage,
    });
    return {
      ok: true,
      message: `Interrupted. ${started.message}`,
    };
  }

  return { ok: true, message: "Build slice interrupted." };
}

export async function finalizeSteerableBuild(options: {
  config: AppConfig;
  slug: string;
  observability: ObservabilityStore;
}): Promise<SteerableBuildFinalizeResult> {
  const { config, slug, observability } = options;
  const record = loadBuildSession(config.stateDir, slug);
  if (!record) {
    throw new Error(`No build session for ${slug}`);
  }

  const acceptancePath = join(
    record.worktreePath,
    record.acceptanceRelativePath,
  );
  unlockAcceptanceTest(acceptancePath);

  const red = runAcceptanceTest(
    record.worktreePath,
    record.acceptanceRelativePath,
  );
  const green = runAcceptanceTest(
    record.worktreePath,
    record.acceptanceRelativePath,
  );
  const hashUnchanged = record.acceptanceHash
    ? verifyAcceptanceHash(acceptancePath, record.acceptanceHash)
    : true;
  const gateOutcome = evaluateRedGreenGates(red, green, hashUnchanged);
  const preflight = runPreflight(record.worktreePath);
  const gitDiff = captureGitDiff(record.worktreePath);
  const changedFiles = listChangedFiles(record.worktreePath);

  const success =
    gateOutcome.greenGateValid && preflight.passed && record.status !== "blocked";

  const finished = saveBuildSession(config.stateDir, {
    ...record,
    status: success ? "finished" : "blocked",
  });

  clearActiveSteerableSession(slug);

  observability.emit(
    "build.session_finished",
    {},
    { slug, success, changedFiles: changedFiles.length },
    "standard",
  );

  return {
    success,
    session: finished,
    gateOutcome,
    preflight,
    changedFiles,
    gitDiff,
    message: success
      ? `Build finished green. Changed: ${changedFiles.join(", ") || "(none)"}`
      : `Build finished with issues. Gates valid=${gateOutcome.greenGateValid}, preflight=${preflight.passed}`,
  };
}

export function getSteerableBuildStatus(
  config: AppConfig,
  slug: string,
): string {
  const record = loadBuildSession(config.stateDir, slug);
  if (!record) return `No build session for ${slug}`;
  return formatBuildSessionSummary(record);
}

export function exportBuildTelemetryForTests(): typeof createBuildTelemetry {
  return createBuildTelemetry;
}

export type { BuildTelemetry };
