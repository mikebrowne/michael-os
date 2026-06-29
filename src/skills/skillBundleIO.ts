import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import type { SkillRegistration, SkillScope, SkillStatus } from "./skillRegistry.js";
import { loadSkillInstructions } from "./skillRegistry.js";

export type SkillBundleWriteInput = {
  name: string;
  description: string;
  body: string;
  scope: SkillScope;
  allowedTools: string[];
  allowedWorkflows?: string[];
  status?: SkillStatus;
  tags?: string[];
  version?: string;
};

function formatYamlArray(values: string[]): string {
  if (values.length === 0) return "[]";
  return `[${values.join(", ")}]`;
}

export function serializeSkillMarkdown(input: SkillBundleWriteInput): string {
  const status = input.status ?? "active";
  const tags = input.tags ?? [];
  const workflows = input.allowedWorkflows ?? [];
  const version = input.version ?? "0.1.0";
  const scopeLine =
    input.scope === "shared"
      ? "shared"
      : formatYamlArray(input.scope);

  return `---
name: ${input.name}
description: ${input.description}
metadata:
  scope: ${scopeLine}
  allowed-tools: ${formatYamlArray(input.allowedTools)}
  allowed-workflows: ${formatYamlArray(workflows)}
  status: ${status}
  tags: ${formatYamlArray(tags)}
  version: ${version}
---

${input.body.trim()}
`;
}

export function writeSkillBundle(
  repoRoot: string,
  input: SkillBundleWriteInput,
): string {
  const bundlePath = join(repoRoot, "skills", input.name);
  mkdirSync(bundlePath, { recursive: true });
  const path = join(bundlePath, "SKILL.md");
  writeFileSync(path, serializeSkillMarkdown(input), "utf-8");
  return path;
}

export function readSkillBundleRaw(repoRoot: string, name: string): string {
  const path = join(repoRoot, "skills", name, "SKILL.md");
  if (!existsSync(path)) {
    throw new Error(`Skill bundle not found: ${name}`);
  }
  return readFileSync(path, "utf-8");
}

export function updateSkillStatus(
  repoRoot: string,
  skill: SkillRegistration,
  status: SkillStatus,
): void {
  writeSkillBundle(repoRoot, {
    name: skill.name,
    description: skill.description,
    body: loadSkillInstructions(repoRoot, skill.name),
    scope: skill.scope,
    allowedTools: skill.allowedTools,
    allowedWorkflows: skill.allowedWorkflows,
    status,
    tags: skill.tags,
  });
}
