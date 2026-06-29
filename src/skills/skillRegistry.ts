import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { resolveAgentSkills } from "@mastra/core/skills";
import type { SkillMetadata } from "@mastra/core/skills";
import { getAgent, listMastraAgents } from "../mastra/agentRegistry.js";
import { canAgentUseTool } from "../engineering/agentAuthority.js";
import {
  collectKnownAgentIds,
  collectKnownToolIds,
  KNOWN_WORKFLOW_IDS,
  listMastraAgentIds,
} from "./skillCatalog.js";
import {
  validateSkillMetadata,
  type SkillValidationResult,
} from "./skillValidation.js";

/** Original Phase 6 migrated skill bundle names. */
export const SKILL_BUNDLE_NAMES = [
  "grill-me-with-docs",
  "to-prd",
  "research-write-tests",
  "build-handoff",
  "ship",
  "code-review",
  "security-review",
] as const;

export type SkillBundleName = (typeof SKILL_BUNDLE_NAMES)[number];

export type SkillScope = "shared" | string[];

export type SkillStatus = "active" | "draft" | "deprecated" | "archived";

export type SkillRegistration = {
  name: string;
  description: string;
  bundlePath: string;
  scope: SkillScope;
  allowedTools: string[];
  allowedWorkflows: string[];
  status: SkillStatus;
  tags: string[];
};

export type SkillValidateResult = SkillValidationResult;

function parseSkillMetadataField<T>(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: T,
): T {
  const value = metadata?.[key];
  return (value ?? fallback) as T;
}

function parseYamlArray(value: string): string[] {
  const match = value.match(/\[([^\]]*)\]/);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseSkillFrontmatter(raw: string): {
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  instructions: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("SKILL.md missing YAML frontmatter");
  }

  const frontmatter = match[1]!;
  const instructions = match[2]!.trim();
  let name = "";
  let description = "";
  const metadata: Record<string, unknown> = {};
  let inMetadata = false;
  let currentMetaKey = "";

  for (const line of frontmatter.split("\n")) {
    if (line.startsWith("metadata:")) {
      inMetadata = true;
      continue;
    }
    if (inMetadata) {
      const metaMatch = line.match(/^\s{2}(\S+):\s*(.*)$/);
      if (metaMatch) {
        currentMetaKey = metaMatch[1]!;
        const rawValue = metaMatch[2]!.trim();
        if (rawValue.startsWith("[")) {
          metadata[currentMetaKey] = parseYamlArray(rawValue);
        } else {
          metadata[currentMetaKey] = rawValue.replace(/^['"]|['"]$/g, "");
        }
        continue;
      }
      if (line.trim() === "" || !line.startsWith("  ")) {
        inMetadata = false;
      }
    }
    if (!inMetadata) {
      const topMatch = line.match(/^(\S+):\s*(.*)$/);
      if (topMatch) {
        const key = topMatch[1]!;
        const val = topMatch[2]!.trim().replace(/^['"]|['"]$/g, "");
        if (key === "name") name = val;
        if (key === "description") description = val;
      }
    }
  }

  return { name, description, metadata, instructions };
}

function toSkillRegistration(
  repoRoot: string,
  meta: SkillMetadata | { name: string; description: string; metadata?: Record<string, unknown> },
  bundlePath?: string,
): SkillRegistration {
  const domain = meta.metadata ?? {};
  const scope = parseSkillMetadataField<SkillScope>(domain, "scope", "shared");
  const allowedTools = parseSkillMetadataField<string[]>(
    domain,
    "allowed-tools",
    [],
  );
  const allowedWorkflows = parseSkillMetadataField<string[]>(
    domain,
    "allowed-workflows",
    [],
  );
  const status = parseSkillMetadataField<SkillStatus>(
    domain,
    "status",
    "active",
  );
  const tags = parseSkillMetadataField<string[]>(domain, "tags", []);

  return {
    name: meta.name,
    description: meta.description,
    bundlePath: bundlePath ?? join(repoRoot, "skills", meta.name),
    scope,
    allowedTools,
    allowedWorkflows,
    status,
    tags,
  };
}

export function listSkillBundleNames(repoRoot: string): string[] {
  const skillsDir = join(repoRoot, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(skillsDir, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
}

export function loadSkillRegistrationSync(
  repoRoot: string,
  name: string,
): SkillRegistration {
  const bundlePath = join(repoRoot, "skills", name);
  const raw = readFileSync(join(bundlePath, "SKILL.md"), "utf-8");
  const parsed = parseSkillFrontmatter(raw);
  return toSkillRegistration(
    repoRoot,
    {
      name: parsed.name,
      description: parsed.description,
      metadata: parsed.metadata,
    },
    bundlePath,
  );
}

export function discoverSkillsSync(repoRoot: string): SkillRegistration[] {
  return listSkillBundleNames(repoRoot).map((name) =>
    loadSkillRegistrationSync(repoRoot, name),
  );
}

/**
 * Discover all skill bundles via Mastra Agent Skills and project domain fields.
 */
export async function discoverSkills(
  repoRoot: string,
): Promise<SkillRegistration[]> {
  const names = listSkillBundleNames(repoRoot);
  const paths = resolveAgentSkillBundlePaths(repoRoot, names);
  const workspaceSkills = resolveAgentSkills(paths);
  const listed = await workspaceSkills.list();
  return listed.map((meta) => toSkillRegistration(repoRoot, meta));
}

function agentsInScope(scope: SkillScope): string[] {
  if (scope === "shared") {
    return listMastraAgentIds();
  }
  return scope;
}

export function skillInScope(skill: SkillRegistration, agentId: string): boolean {
  if (skill.scope === "shared") return true;
  return skill.scope.includes(agentId);
}

export function skillAuthorityOkForAgent(
  skill: SkillRegistration,
  agentId: string,
): boolean {
  const agent = getAgent(agentId);
  if (!agent) return false;
  for (const toolId of skill.allowedTools) {
    if (!canAgentUseTool(agent.authority, toolId)) {
      return false;
    }
  }
  return true;
}

export function canInjectSkill(
  skill: SkillRegistration,
  agentId: string,
): boolean {
  if (skill.status !== "active") return false;
  if (!skillInScope(skill, agentId)) return false;
  return skillAuthorityOkForAgent(skill, agentId);
}

function validateScope(scope: SkillScope, errors: string[]): void {
  const knownAgents = collectKnownAgentIds();
  if (scope === "shared") return;
  if (!Array.isArray(scope) || scope.length === 0) {
    errors.push("scope must be 'shared' or a non-empty agent id array");
    return;
  }
  for (const agentId of scope) {
    if (!knownAgents.has(agentId)) {
      errors.push(`scope references unknown agent id: ${agentId}`);
    }
  }
}

function validateAllowedTools(
  skill: SkillRegistration,
  errors: string[],
): void {
  const knownTools = collectKnownToolIds();
  for (const toolId of skill.allowedTools) {
    if (!knownTools.has(toolId)) {
      errors.push(`allowed-tools references unknown tool: ${toolId}`);
    }
  }
  for (const agentId of agentsInScope(skill.scope)) {
    if (!skillAuthorityOkForAgent(skill, agentId)) {
      errors.push(
        `allowed-tools exceed authority for agent "${agentId}" (tool(s) require management clearance)`,
      );
    }
  }
}

function validateAllowedWorkflows(
  skill: SkillRegistration,
  errors: string[],
): void {
  const known = new Set<string>(KNOWN_WORKFLOW_IDS);
  for (const wfId of skill.allowedWorkflows) {
    if (!known.has(wfId)) {
      errors.push(`allowed-workflows references unknown workflow: ${wfId}`);
    }
  }
}

export function validateSkillRegistration(
  skill: SkillRegistration,
  instructions?: string,
): SkillValidateResult {
  const dirName = basename(skill.bundlePath);
  const mastraResult = validateSkillMetadata(
    {
      name: skill.name,
      description: skill.description,
      metadata: {
        scope: skill.scope,
        "allowed-tools": skill.allowedTools,
        "allowed-workflows": skill.allowedWorkflows,
        status: skill.status,
        tags: skill.tags,
      },
    },
    dirName,
  );

  const errors = [...mastraResult.errors];
  const warnings = [...mastraResult.warnings];

  validateScope(skill.scope, errors);
  validateAllowedTools(skill, errors);
  validateAllowedWorkflows(skill, errors);

  if (instructions !== undefined && instructions.trim().length === 0) {
    errors.push("Skill instructions body is empty");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateSkill(
  repoRoot: string,
  nameOrPath: string,
): SkillValidateResult {
  const name = nameOrPath.includes("/")
    ? basename(nameOrPath)
    : nameOrPath;
  const skill = loadSkillRegistrationSync(repoRoot, name);
  const raw = readFileSync(join(skill.bundlePath, "SKILL.md"), "utf-8");
  const { instructions } = parseSkillFrontmatter(raw);
  return validateSkillRegistration(skill, instructions);
}

/**
 * Resolve absolute bundle paths for an agent from frontmatter scope + authority.
 */
export function resolveSkillsForAgent(
  repoRoot: string,
  agentId: string,
): string[] {
  return discoverSkillsSync(repoRoot)
    .filter((skill) => canInjectSkill(skill, agentId))
    .map((skill) => skill.bundlePath);
}

/**
 * Resolve skill names injectable for an agent (derived view).
 */
export function resolveSkillNamesForAgent(
  repoRoot: string,
  agentId: string,
): string[] {
  return discoverSkillsSync(repoRoot)
    .filter((skill) => canInjectSkill(skill, agentId))
    .map((skill) => skill.name);
}

/**
 * Project frontmatter scope onto agent ids (derived view for agentRegistry validation).
 */
export function deriveAgentSkillsFromRegistry(
  repoRoot: string,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const agentId of listMastraAgentIds()) {
    map.set(agentId, resolveSkillNamesForAgent(repoRoot, agentId));
  }
  return map;
}

/**
 * Assert hardcoded agentRegistry.skills matches frontmatter projection.
 */
export function assertAgentRegistryMatchesSkills(repoRoot: string): void {
  const derived = deriveAgentSkillsFromRegistry(repoRoot);
  for (const agent of listMastraAgents()) {
    if (!agent.skills) continue;
    const expected = [...agent.skills].sort();
    const projected = [...(derived.get(agent.id) ?? [])].sort();
    if (JSON.stringify(expected) !== JSON.stringify(projected)) {
      throw new Error(
        `agentRegistry skills for "${agent.id}" diverges from frontmatter scope: expected [${expected.join(", ")}] but projected [${projected.join(", ")}]`,
      );
    }
  }
}

/**
 * Resolve absolute bundle directory paths for Agent.skills config (legacy helper).
 */
export function resolveAgentSkillBundlePaths(
  repoRoot: string,
  skillNames: readonly string[],
): string[] {
  return skillNames.map((name) => join(repoRoot, "skills", name));
}

/**
 * Load a skill's markdown body synchronously (QA Engineer embed path).
 */
export function loadSkillInstructions(repoRoot: string, name: string): string {
  const path = join(repoRoot, "skills", name, "SKILL.md");
  const raw = readFileSync(path, "utf-8");
  const { instructions } = parseSkillFrontmatter(raw);
  return instructions;
}

/** Authoring skills scoped only to Skill Engineer (Slice 4). */
export const AUTHORING_SKILL_NAMES = ["write-skill", "skill-eval-design"] as const;

export function qaNeverGetsAuthoringSkills(repoRoot: string): boolean {
  const qaSkills = resolveSkillNamesForAgent(repoRoot, "qa-engineer");
  return !AUTHORING_SKILL_NAMES.some((name) => qaSkills.includes(name));
}
