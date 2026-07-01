import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import type {
  AgentAuthority,
  AgentKind,
  AgentRegistration,
} from "../mastra/agentRegistration.js";
import { canAgentUseTool } from "../engineering/agentAuthority.js";
import { collectKnownToolIds } from "../skills/skillCatalog.js";
import { KNOWN_WORKFLOW_IDS } from "../skills/skillCatalog.js";

export type AgentBundleRegistration = AgentRegistration & {
  bundlePath: string;
  status: "active" | "draft" | "archived";
};

function parseYamlArray(value: string): string[] {
  const match = value.match(/\[([^\]]*)\]/);
  if (!match?.[1]) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function parseAgentFrontmatter(raw: string): {
  id: string;
  role: string;
  kind: AgentKind;
  authority: AgentAuthority;
  description: string;
  model?: string;
  directChat: boolean;
  standalone: boolean;
  skills: string[];
  tools: string[];
  status: "active" | "draft" | "archived";
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n([\s\S]*))?$/);
  if (!match) {
    throw new Error("agent.md missing YAML frontmatter");
  }

  const frontmatter = match[1]!;
  let id = "";
  let role = "";
  let kind: AgentKind = "mastra-agent";
  let authority: AgentAuthority = "employee";
  let description = "";
  let model: string | undefined;
  let directChat = false;
  let standalone = false;
  let skills: string[] = [];
  let tools: string[] = [];
  let status: "active" | "draft" | "archived" = "active";
  let currentListKey: "skills" | "tools" | null = null;

  for (const line of frontmatter.split("\n")) {
    if (line.match(/^skills:\s*$/)) {
      currentListKey = "skills";
      continue;
    }
    if (line.match(/^tools:\s*$/)) {
      currentListKey = "tools";
      continue;
    }
    if (currentListKey && line.match(/^\s+-\s+/)) {
      const item = line.replace(/^\s+-\s+/, "").trim();
      if (currentListKey === "skills") skills.push(item);
      else tools.push(item);
      continue;
    }
    if (!line.startsWith("  ") && !line.startsWith("\t")) {
      currentListKey = null;
    }

    const topMatch = line.match(/^(\S+):\s*(.*)$/);
    if (!topMatch) continue;
    const key = topMatch[1]!;
    const val = topMatch[2]!.trim().replace(/^['"]|['"]$/g, "");

    switch (key) {
      case "id":
        id = val;
        break;
      case "role":
        role = val;
        break;
      case "kind":
        kind = val as AgentKind;
        break;
      case "authority":
        authority = val as AgentAuthority;
        break;
      case "description":
        description = val;
        break;
      case "model":
        model = val || undefined;
        break;
      case "directChat":
        directChat = val === "true";
        break;
      case "standalone":
        standalone = val === "true";
        break;
      case "status":
        status = val as "active" | "draft" | "archived";
        break;
      case "skills":
        if (val.startsWith("[")) skills = parseYamlArray(val);
        break;
      case "tools":
        if (val.startsWith("[")) tools = parseYamlArray(val);
        break;
    }
  }

  return {
    id,
    role,
    kind,
    authority,
    description,
    model,
    directChat,
    standalone,
    skills,
    tools,
    status,
  };
}

export function listAgentBundleIds(repoRoot: string): string[] {
  const agentsDir = join(repoRoot, "agents");
  if (!existsSync(agentsDir)) return [];
  return readdirSync(agentsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (existsSync(join(agentsDir, entry.name, "agent.md")) ||
          existsSync(join(agentsDir, entry.name, "agent.yaml"))),
    )
    .map((entry) => entry.name)
    .sort();
}

export function loadAgentBundleSync(
  repoRoot: string,
  id: string,
): AgentBundleRegistration {
  const bundlePath = join(repoRoot, "agents", id);
  const mdPath = join(bundlePath, "agent.md");
  const yamlPath = join(bundlePath, "agent.yaml");
  const configPath = existsSync(mdPath) ? mdPath : yamlPath;
  const raw = readFileSync(configPath, "utf-8");
  const parsed = parseAgentFrontmatter(raw);

  return {
    ...parsed,
    bundlePath,
    skills: parsed.skills.length > 0 ? parsed.skills : undefined,
    tools: parsed.tools.length > 0 ? parsed.tools : undefined,
  };
}

export function discoverAgentBundlesSync(
  repoRoot: string,
): AgentBundleRegistration[] {
  return listAgentBundleIds(repoRoot).map((id) =>
    loadAgentBundleSync(repoRoot, id),
  );
}

export function discoverActiveAgentBundlesSync(
  repoRoot: string,
): AgentRegistration[] {
  return discoverAgentBundlesSync(repoRoot)
    .filter((b) => b.status === "active")
    .map(({ bundlePath: _bp, status: _s, ...reg }) => reg);
}

export function validateAgentBundle(
  bundle: AgentBundleRegistration,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const dirName = basename(bundle.bundlePath);

  if (bundle.id !== dirName) {
    errors.push(`id "${bundle.id}" must match directory name "${dirName}"`);
  }
  if (!bundle.role.trim()) errors.push("role is required");
  if (!bundle.description.trim()) errors.push("description is required");

  const knownTools = collectKnownToolIds();
  for (const toolId of bundle.tools ?? []) {
    if (!knownTools.has(toolId)) {
      errors.push(`tools references unknown tool: ${toolId}`);
    }
    if (!canAgentUseTool(bundle.authority, toolId)) {
      errors.push(
        `employee agent "${bundle.id}" cannot hold management-only tool: ${toolId}`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAllAgentBundles(
  repoRoot: string,
): { valid: boolean; errors: string[] } {
  const allErrors: string[] = [];
  for (const bundle of discoverAgentBundlesSync(repoRoot)) {
    const result = validateAgentBundle(bundle);
    allErrors.push(...result.errors.map((e) => `${bundle.id}: ${e}`));
  }
  return { valid: allErrors.length === 0, errors: allErrors };
}

export function employeeBundleCannotHoldManagementTools(
  bundle: AgentBundleRegistration,
): boolean {
  if (bundle.authority !== "employee") return true;
  for (const toolId of bundle.tools ?? []) {
    if (!canAgentUseTool("employee", toolId)) return false;
  }
  return true;
}

/** Known workflow ids an agent bundle may reference (future extension). */
export const AGENT_BUNDLE_KNOWN_WORKFLOWS = KNOWN_WORKFLOW_IDS;
