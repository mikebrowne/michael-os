import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { AppConfig } from "../config/loadConfig.js";
import type { ObservabilityStore } from "../observability/observabilityStore.js";
import type { EngineeringSessionContext } from "../engineering/sessionContext.js";
import { runComprehension } from "../agentBuild/comprehension.js";
import { createRunLogger } from "../logging/runLogger.js";
import {
  scanRegistriesForReuse,
  suggestRouteFromRegistry,
} from "./engagementTriageRegistry.js";
import {
  logNecessityVerdictEvent,
  writeNecessityVerdict,
  type NecessityDecision,
  type NecessitySource,
  type NecessityVerdict,
} from "./necessityVerdict.js";

export type EngagementTriageContext = {
  config: AppConfig;
  observability: ObservabilityStore;
  engineeringCtx: EngineeringSessionContext;
  repoRoot: string;
};

export function createEngagementTriageTools(ctx: EngagementTriageContext) {
  const runLogger = createRunLogger({
    logDir: ctx.config.logDir,
    logLevel: ctx.config.logLevel,
    name: ctx.config.appName,
  });

  const registryScan = createTool({
    id: "registry-scan",
    description:
      "Deterministic keyword scan of agentRegistry, skillRegistry, and known tools for reuse candidates.",
    inputSchema: z.object({
      query: z.string().describe("The operator need to match against registries"),
    }),
    execute: async ({ query }) => {
      const matches = scanRegistriesForReuse(query, ctx.repoRoot);
      const suggestedRoute = suggestRouteFromRegistry(matches);
      return {
        matchCount: matches.length,
        matches,
        suggestedRoute,
      };
    },
  });

  const comprehendReuse = createTool({
    id: "comprehend-reuse",
    description:
      "Read-only Cursor comprehension: does something like this already exist in the codebase?",
    inputSchema: z.object({
      question: z.string().describe("Reuse discovery question"),
    }),
    execute: async ({ question }) => {
      const result = await runComprehension({
        config: ctx.config,
        repoPath: ctx.repoRoot,
        observability: ctx.observability,
        question: `Reuse discovery: ${question}. List existing capabilities that could be reused or adapted.`,
      });
      return {
        answer: result.answer,
        citations: result.citations,
        allCitationsVerified: result.allCitationsVerified,
        verification: result.verification,
      };
    },
  });

  const frameworkFirstCheck = createTool({
    id: "framework-first-check",
    description:
      "Judgment step: would Mastra or an installed library already provide this capability (framework-first)?",
    inputSchema: z.object({
      need: z.string().describe("Capability the operator is asking for"),
      notes: z
        .string()
        .optional()
        .describe("Optional notes from registry scan or comprehension"),
    }),
    execute: async ({ need, notes }) => ({
      guidance:
        "Check installed Mastra (@mastra/core version in package.json) and framework-first rule before building custom. Cite specific Mastra primitives or docs if recommending reuse.",
      need,
      notes: notes ?? "",
      checklist: [
        "Search Mastra docs for the capability by name",
        "Check package.json installed version APIs",
        "Prefer thin wrapper over hand-rolled primitive",
      ],
    }),
  });

  const recordNecessityVerdict = createTool({
    id: "record-necessity-verdict",
    description:
      "Record build/reuse/adapt necessity verdict to disk and run log for the current work item.",
    inputSchema: z.object({
      decision: z.enum(["build", "reuse", "adapt"]),
      rationale: z.string(),
      sources: z.array(
        z.object({
          kind: z.enum(["registry", "comprehension", "framework-first"]),
          summary: z.string(),
          refs: z.array(z.string()).optional(),
        }),
      ),
      routedTo: z.string().optional(),
    }),
    execute: async (input) => {
      const slug = ctx.engineeringCtx.currentWorkItem?.slug;
      if (!slug) {
        return {
          ok: false as const,
          message: "No current work item — resume #N or start intake first.",
        };
      }
      const verdict: NecessityVerdict = {
        decision: input.decision as NecessityDecision,
        rationale: input.rationale,
        sources: input.sources as NecessitySource[],
        timestamp: new Date().toISOString(),
        routedTo: input.routedTo,
        workItemSlug: slug,
      };
      const path = writeNecessityVerdict(ctx.config.stateDir, verdict);
      logNecessityVerdictEvent(runLogger, verdict);
      return { ok: true as const, path, verdict };
    },
  });

  return {
    registryScan,
    comprehendReuse,
    frameworkFirstCheck,
    recordNecessityVerdict,
  };
}

export type EngagementTriageTools = ReturnType<typeof createEngagementTriageTools>;
