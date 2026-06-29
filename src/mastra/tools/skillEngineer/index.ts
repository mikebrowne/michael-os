import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SkillEngineerSessionContext } from "../../../skills/skillEngineerSession.js";
import {
  validateSkill,
  loadSkillRegistrationSync,
  loadSkillInstructions,
  type SkillScope,
} from "../../../skills/skillRegistry.js";
import { writeSkillBundle } from "../../../skills/skillBundleIO.js";
import {
  detectNewDangerousAllowedTools,
  skillChangeApprovalKey,
} from "../../../skills/skillLifecycle.js";
import {
  consumeApproval,
  needsApprovalMessage,
} from "../../../engineering/approvalGate.js";
import { createIssue } from "../../../engineering/github.js";

function parseScopeInput(scope: string | string[]): SkillScope {
  if (scope === "shared") return "shared";
  if (Array.isArray(scope)) return scope;
  return scope.split(",").map((s) => s.trim()).filter(Boolean);
}

function checkDangerousDeclaration(
  ctx: SkillEngineerSessionContext,
  skillName: string,
  previousTools: string[],
  nextTools: string[],
): string | null {
  const newlyDangerous = detectNewDangerousAllowedTools(previousTools, nextTools);
  if (newlyDangerous.length === 0) return null;
  const approvalKey = skillChangeApprovalKey(skillName);
  if (consumeApproval(ctx.approval, approvalKey)) {
    return null;
  }
  ctx.approval.pending = {
    toolId: approvalKey,
    args: { skillName, newlyDangerous },
  };
  ctx.observability.emit(
    "approval.requested",
    {},
    { toolId: approvalKey, skillName, newlyDangerous },
    "standard",
  );
  return `${needsApprovalMessage(approvalKey)} Declares new dangerous tool(s): ${newlyDangerous.join(", ")}.`;
}

export function createSkillEngineerTools(ctx: SkillEngineerSessionContext) {
  const createSkill = createTool({
    id: "create-skill",
    description: "Create a new skill bundle (SKILL.md) under skills/<name>/.",
    inputSchema: z.object({
      name: z.string(),
      description: z.string(),
      body: z.string(),
      scope: z.union([z.literal("shared"), z.array(z.string()), z.string()]),
      allowedTools: z.array(z.string()).default([]),
      allowedWorkflows: z.array(z.string()).default([]),
      tags: z.array(z.string()).default([]),
    }),
    execute: async (input) => {
      const bundlePath = join(ctx.repoPath, "skills", input.name);
      if (existsSync(bundlePath)) {
        throw new Error(`Skill already exists: ${input.name}`);
      }
      const scope = parseScopeInput(input.scope);
      const dangerousMsg = checkDangerousDeclaration(
        ctx,
        input.name,
        [],
        input.allowedTools ?? [],
      );
      if (dangerousMsg) {
        return { needsApproval: true, message: dangerousMsg };
      }
      writeSkillBundle(ctx.repoPath, {
        name: input.name,
        description: input.description,
        body: input.body,
        scope,
        allowedTools: input.allowedTools ?? [],
        allowedWorkflows: input.allowedWorkflows ?? [],
        tags: input.tags ?? [],
        status: "active",
      });
      const validation = validateSkill(
        ctx.repoPath,
        input.name,
        ctx.skillTelemetry,
      );
      ctx.skillTelemetry.changed(input.name, "create", "active");
      return { path: bundlePath, validation };
    },
  });

  const editSkill = createTool({
    id: "edit-skill",
    description: "Edit an existing skill bundle body and/or metadata.",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().optional(),
      body: z.string().optional(),
      scope: z.union([z.literal("shared"), z.array(z.string()), z.string()]).optional(),
      allowedTools: z.array(z.string()).optional(),
      allowedWorkflows: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    }),
    execute: async (input) => {
      const existing = loadSkillRegistrationSync(ctx.repoPath, input.name);
      const nextTools = input.allowedTools ?? existing.allowedTools;
      const dangerousMsg = checkDangerousDeclaration(
        ctx,
        input.name,
        existing.allowedTools,
        nextTools,
      );
      if (dangerousMsg) {
        return { needsApproval: true, message: dangerousMsg };
      }
      const scope = input.scope
        ? parseScopeInput(input.scope)
        : existing.scope;
      const body = input.body ?? loadSkillInstructions(ctx.repoPath, input.name);
      writeSkillBundle(ctx.repoPath, {
        name: input.name,
        description: input.description ?? existing.description,
        body,
        scope,
        allowedTools: nextTools,
        allowedWorkflows: input.allowedWorkflows ?? existing.allowedWorkflows,
        tags: input.tags ?? existing.tags,
        status: existing.status,
      });
      const validation = validateSkill(
        ctx.repoPath,
        input.name,
        ctx.skillTelemetry,
      );
      ctx.skillTelemetry.changed(input.name, "edit", existing.status);
      return { validation };
    },
  });

  const validateSkillTool = createTool({
    id: "validate-skill",
    description: "Validate a skill bundle (schema, scope, permissions).",
    inputSchema: z.object({ name: z.string() }),
    execute: async (input) =>
      validateSkill(ctx.repoPath, input.name, ctx.skillTelemetry),
  });

  const evalSkill = createTool({
    id: "eval-skill",
    description: "Run eval cases from a skill bundle evals/ folder.",
    inputSchema: z.object({ name: z.string() }),
    execute: async (input) => {
      const evalsDir = join(ctx.repoPath, "skills", input.name, "evals");
      if (!existsSync(evalsDir)) {
        return {
          passed: false,
          message: `No evals/ folder for skill "${input.name}". Add cases in Slice 5 EDD harness.`,
        };
      }
      return {
        passed: false,
        message:
          "Eval runner wired in npm run eval:skills (local-only). Use that script for full EDD.",
        skillName: input.name,
      };
    },
  });

  const deprecateSkill = createTool({
    id: "deprecate-skill",
    description: "Mark a skill as deprecated (still visible).",
    inputSchema: z.object({ name: z.string() }),
    execute: async (input) => {
      const skill = loadSkillRegistrationSync(ctx.repoPath, input.name);
      const body = loadSkillInstructions(ctx.repoPath, input.name);
      writeSkillBundle(ctx.repoPath, {
        name: skill.name,
        description: skill.description,
        body,
        scope: skill.scope,
        allowedTools: skill.allowedTools,
        allowedWorkflows: skill.allowedWorkflows,
        tags: skill.tags,
        status: "deprecated",
      });
      ctx.skillTelemetry.changed(input.name, "deprecate", "deprecated");
      return { status: "deprecated" };
    },
  });

  const archiveSkill = createTool({
    id: "archive-skill",
    description: "Archive a skill (removed from active injection set).",
    inputSchema: z.object({ name: z.string() }),
    execute: async (input) => {
      const skill = loadSkillRegistrationSync(ctx.repoPath, input.name);
      const body = loadSkillInstructions(ctx.repoPath, input.name);
      writeSkillBundle(ctx.repoPath, {
        name: skill.name,
        description: skill.description,
        body,
        scope: skill.scope,
        allowedTools: skill.allowedTools,
        allowedWorkflows: skill.allowedWorkflows,
        tags: skill.tags,
        status: "archived",
      });
      ctx.skillTelemetry.changed(input.name, "archive", "archived");
      return { status: "archived" };
    },
  });

  const requestToolBuild = createTool({
    id: "request-tool-build",
    description:
      "File a tracked GitHub Issue handoff to the Engineering Lead to build a new tool.",
    inputSchema: z.object({
      title: z.string(),
      description: z.string(),
      skillName: z.string().optional(),
    }),
    execute: async (input) => {
      const body = `# Tool build request

${input.description}

${input.skillName ? `Requested by skill: \`${input.skillName}\`\n` : ""}
## Handoff

Routed to **Engineering Lead** for build → QA → promote (not in-process delegation).

## Acceptance

- [ ] Tool implemented and promoted through Phase 5 loop
- [ ] Skill \`allowed-tools\` updated to reference the new tool
`;
      const result = await createIssue(ctx.ghRunner, ctx.githubRepo, {
        title: `[tool-build] ${input.title}`,
        body,
        labels: ["tool-build"],
      });
      return {
        issueNumber: result.issueNumber,
        stdout: result.stdout,
      };
    },
  });

  return {
    createSkill,
    editSkill,
    validateSkillTool,
    evalSkill,
    deprecateSkill,
    archiveSkill,
    requestToolBuild,
  };
}
