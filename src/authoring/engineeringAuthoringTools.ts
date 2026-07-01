import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
  loadAgentBundleSync,
  validateAgentBundle,
} from "./agentBundleRegistry.js";
import {
  requestActivationApproval,
  logActivationAudit,
} from "./authoringApprovalSeam.js";
import { assertSkillHasEvalBeforeActivation } from "./skillUsageSignal.js";
import { loadSkillInstructions } from "../skills/skillRegistry.js";
import { canAgentUseTool } from "../engineering/agentAuthority.js";
import type { EngineeringSessionContext } from "../engineering/sessionContext.js";
import { createAuthoringTools } from "./authoringTools.js";

export type OnboardingSmokeResult = {
  passed: boolean;
  agentId: string;
  checks: Array<{ name: string; passed: boolean; message?: string }>;
};

export function runOnboardingSmokeTest(
  repoRoot: string,
  agentId: string,
): OnboardingSmokeResult {
  const checks: OnboardingSmokeResult["checks"] = [];

  const bundlePath = join(repoRoot, "agents", agentId, "agent.md");
  checks.push({ name: "bundle-exists", passed: existsSync(bundlePath) });

  try {
    const bundle = loadAgentBundleSync(repoRoot, agentId);
    const validation = validateAgentBundle(bundle);
    checks.push({
      name: "bundle-valid",
      passed: validation.valid,
      message: validation.errors.join("; ") || undefined,
    });
    const authorityOk =
      bundle.authority !== "employee" ||
      (bundle.tools ?? []).every((t) => canAgentUseTool("employee", t));
    checks.push({
      name: "authority-invariant",
      passed: authorityOk,
      message: authorityOk ? undefined : "Employee bundle holds management-only tools",
    });
  } catch (error) {
    checks.push({
      name: "bundle-load",
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    agentId,
    checks,
  };
}

function setAgentBundleStatus(
  repoRoot: string,
  agentId: string,
  status: "active" | "draft" | "archived",
): void {
  const path = join(repoRoot, "agents", agentId, "agent.md");
  const raw = readFileSync(path, "utf-8");
  const updated = raw.replace(/status:\s*(active|draft|archived)/, `status: ${status}`);
  writeFileSync(path, updated, "utf-8");
}

export function createEngineeringAuthoringTools(ctx: EngineeringSessionContext) {
  const authoring = createAuthoringTools({
    repoPath: ctx.repoPath,
    githubRepo: ctx.githubRepo,
    ghRunner: ctx.ghRunner,
    approval: ctx.approval,
    observability: ctx.observability,
    telemetry: ctx.telemetry,
    authoringCap: ctx.config.authoringCap,
    proposalsEnabled: ctx.config.authoringProposalsEnabled,
  });

  const hardenSkillIntoTool = createTool({
    id: "harden-skill-into-tool",
    description: "Scaffold a deterministic tool from a hot skill (Tool Author).",
    inputSchema: z.object({
      skillName: z.string(),
      toolId: z.string(),
      description: z.string(),
    }),
    execute: async (input) => {
      const evalCheck = assertSkillHasEvalBeforeActivation(ctx.repoPath, input.skillName);
      if (!evalCheck.ok) {
        return { blocked: true, message: evalCheck.message };
      }
      let instructions = "";
      try {
        instructions = loadSkillInstructions(ctx.repoPath, input.skillName);
      } catch {
        return { blocked: true, message: `Skill not found: ${input.skillName}` };
      }

      const toolDir = join(ctx.repoPath, "src/mastra/tools/authoring");
      mkdirSync(toolDir, { recursive: true });
      const toolPath = join(toolDir, `${input.toolId}.ts`);
      const varName = input.toolId.replace(/-/g, "_");
      const stub = [
        `import { createTool } from "@mastra/core/tools";`,
        `import { z } from "zod";`,
        `import { isSkillTestMode } from "../../../skills/skillTestMode.js";`,
        ``,
        `export const ${varName}Tool = createTool({`,
        `  id: "${input.toolId}",`,
        `  description: ${JSON.stringify(input.description)},`,
        `  inputSchema: z.object({ input: z.string() }),`,
        `  execute: async (input, context) => {`,
        `    if (isSkillTestMode(context?.requestContext)) {`,
        `      return { mocked: true, result: { id: "${input.toolId}-mock" } };`,
        `    }`,
        `    return { result: input.input.slice(0, 200) };`,
        `  },`,
        `});`,
        `// Hardened from skill: ${input.skillName}`,
        `// ${instructions.slice(0, 80).replace(/\n/g, " ")}`,
      ].join("\n");
      writeFileSync(toolPath, stub, "utf-8");

      ctx.observability.emit(
        "authoring.drafted",
        {},
        { form: "tool", artifactId: input.toolId, skillName: input.skillName },
        "standard",
      );

      return { toolId: input.toolId, path: toolPath };
    },
  });

  const scaffoldWorkflow = createTool({
    id: "scaffold-workflow",
    description: "Scaffold a workflow file (Workflow Author).",
    inputSchema: z.object({
      workflowId: z.string(),
      description: z.string(),
    }),
    execute: async (input) => {
      const workflowPath = join(
        ctx.repoPath,
        "src/mastra/workflows",
        `${input.workflowId}.ts`,
      );
      if (existsSync(workflowPath)) {
        return { blocked: true, message: `Workflow exists: ${input.workflowId}` };
      }
      const varName = input.workflowId.replace(/-/g, "_");
      writeFileSync(
        workflowPath,
        [
          `import { createWorkflow, createStep } from "@mastra/core/workflows";`,
          `import { z } from "zod";`,
          `const step = createStep({`,
          `  id: "passthrough",`,
          `  inputSchema: z.object({ value: z.string() }),`,
          `  outputSchema: z.object({ value: z.string() }),`,
          `  execute: async ({ inputData }) => ({ value: inputData.value }),`,
          `});`,
          `export const ${varName}Workflow = createWorkflow({`,
          `  id: "${input.workflowId}",`,
          `  description: ${JSON.stringify(input.description)},`,
          `  inputSchema: z.object({ value: z.string() }),`,
          `  outputSchema: z.object({ value: z.string() }),`,
          `}).then(step);`,
        ].join("\n"),
        "utf-8",
      );
      return { workflowId: input.workflowId, path: workflowPath };
    },
  });

  const draftAgentBundle = createTool({
    id: "draft-agent-bundle",
    description: "Draft an agent bundle job description (Hiring).",
    inputSchema: z.object({
      id: z.string(),
      role: z.string(),
      authority: z.enum(["management", "employee"]),
      description: z.string(),
      skills: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      directChat: z.boolean().optional(),
      standalone: z.boolean().optional(),
    }),
    execute: async (input) => {
      const bundleDir = join(ctx.repoPath, "agents", input.id);
      const agentPath = join(bundleDir, "agent.md");
      if (existsSync(agentPath)) {
        return { blocked: true, message: `Bundle exists: ${input.id}` };
      }
      mkdirSync(bundleDir, { recursive: true });
      const lines = [
        "---",
        `id: ${input.id}`,
        `role: ${input.role}`,
        "kind: mastra-agent",
        `authority: ${input.authority}`,
        `description: ${input.description}`,
        `directChat: ${input.directChat ?? false}`,
        `standalone: ${input.standalone ?? true}`,
        "status: draft",
      ];
      if (input.skills?.length) {
        lines.push("skills:");
        for (const s of input.skills) lines.push(`  - ${s}`);
      }
      if (input.tools?.length) {
        lines.push("tools:");
        for (const t of input.tools) lines.push(`  - ${t}`);
      }
      lines.push("---", "", `# ${input.role}`);
      writeFileSync(agentPath, lines.join("\n"), "utf-8");
      return { agentId: input.id, path: agentPath, status: "draft" };
    },
  });

  const onboardAgentTool = createTool({
    id: "onboard-agent-tool",
    description: "Run onboarding smoke-test for a hired agent (probation).",
    inputSchema: z.object({ agentId: z.string() }),
    execute: async (input) => runOnboardingSmokeTest(ctx.repoPath, input.agentId),
  });

  const activateAgent = createTool({
    id: "activate-agent",
    description: "Activate a hired agent after passing onboarding smoke-test.",
    inputSchema: z.object({
      agentId: z.string(),
      requiresRestart: z.boolean().optional(),
    }),
    execute: async (input) => {
      const smoke = runOnboardingSmokeTest(ctx.repoPath, input.agentId);
      if (!smoke.passed) {
        return {
          blocked: true,
          message: `Onboarding smoke-test failed for "${input.agentId}"`,
          checks: smoke.checks,
        };
      }

      const seam = requestActivationApproval(ctx.approval, {
        category: "agent",
        artifactId: input.agentId,
      });
      if (!seam.approved) {
        return { needsApproval: true, message: seam.message };
      }

      logActivationAudit(ctx.observability, ctx.telemetry, {
        category: "agent",
        artifactId: input.agentId,
        approved: true,
        autoApproved: seam.autoApproved,
      });

      setAgentBundleStatus(ctx.repoPath, input.agentId, "active");

      return {
        activated: true,
        agentId: input.agentId,
        requiresRestart: input.requiresRestart ?? true,
      };
    },
  });

  return {
    proposeExtension: authoring.proposeExtension,
    requestActivation: authoring.requestActivation,
    hardenSkillIntoTool,
    scaffoldWorkflow,
    draftAgentBundle,
    onboardAgentTool,
    activateAgent,
  };
}
