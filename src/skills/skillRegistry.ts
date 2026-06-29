import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveAgentSkills } from "@mastra/core/skills";
import type { SkillMetadata } from "@mastra/core/skills";

/** All discovered skill bundle directory names under `skills/`. */
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

export type SkillStatus = "active" | "draft" | "deprecated";

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

function parseSkillMetadataField<T>(
  metadata: Record<string, unknown> | undefined,
  key: string,
  fallback: T,
): T {
  const value = metadata?.[key];
  return (value ?? fallback) as T;
}

function toSkillRegistration(
  repoRoot: string,
  meta: SkillMetadata,
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
    bundlePath: join(repoRoot, "skills", meta.name),
    scope,
    allowedTools,
    allowedWorkflows,
    status,
    tags,
  };
}

/**
 * Discover all skill bundles via Mastra Agent Skills and project domain fields.
 */
export async function discoverSkills(
  repoRoot: string,
): Promise<SkillRegistration[]> {
  const paths = resolveAgentSkillBundlePaths(repoRoot, [...SKILL_BUNDLE_NAMES]);
  const workspaceSkills = resolveAgentSkills(paths);
  const listed = await workspaceSkills.list();
  return listed.map((meta) => toSkillRegistration(repoRoot, meta));
}

/**
 * Resolve absolute bundle directory paths for Agent.skills config.
 */
export function resolveAgentSkillBundlePaths(
  repoRoot: string,
  skillNames: readonly string[],
): string[] {
  return skillNames.map((name) => join(repoRoot, "skills", name));
}

/**
 * Split SKILL.md into frontmatter and body (sync, for QA embed only).
 */
function splitSkillMarkdown(raw: string): { body: string } {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { body: raw.trim() };
  }
  return { body: match[1]!.trim() };
}

/**
 * Load a skill's markdown body synchronously (QA Engineer embed path).
 * Mastra remains the authority for discovery, validation, and progressive loading.
 */
export function loadSkillInstructions(repoRoot: string, name: string): string {
  const path = join(repoRoot, "skills", name, "SKILL.md");
  const raw = readFileSync(path, "utf-8");
  return splitSkillMarkdown(raw).body;
}
