import { listAgents } from "../mastra/agentRegistry.js";
import { discoverSkillsSync } from "../skills/skillRegistry.js";
import { collectKnownToolIds } from "../skills/skillCatalog.js";

export type RegistryScanMatch = {
  kind: "agent" | "skill" | "tool";
  id: string;
  summary: string;
  score: number;
};

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function scoreText(tokens: string[], text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (lower.includes(token)) score += 1;
  }
  return score;
}

export function scanRegistriesForReuse(
  query: string,
  repoRoot: string = process.cwd(),
): RegistryScanMatch[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const matches: RegistryScanMatch[] = [];

  for (const agent of listAgents(repoRoot)) {
    const haystack = `${agent.id} ${agent.role} ${agent.description}`;
    const score = scoreText(tokens, haystack);
    if (score > 0) {
      matches.push({
        kind: "agent",
        id: agent.id,
        summary: `${agent.role}: ${agent.description}`,
        score,
      });
    }
  }

  for (const skill of discoverSkillsSync(repoRoot)) {
    if (skill.status === "archived") continue;
    const tags = Array.isArray(skill.tags) ? skill.tags.join(" ") : "";
    const haystack = `${skill.name} ${skill.description} ${tags}`;
    const score = scoreText(tokens, haystack);
    if (score > 0) {
      matches.push({
        kind: "skill",
        id: skill.name,
        summary: skill.description,
        score,
      });
    }
  }

  for (const toolId of collectKnownToolIds()) {
    const score = scoreText(tokens, toolId.replace(/-/g, " "));
    if (score > 0) {
      matches.push({
        kind: "tool",
        id: toolId,
        summary: `Registered tool: ${toolId}`,
        score,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function suggestRouteFromRegistry(
  matches: RegistryScanMatch[],
): string | undefined {
  const skillEngineerSignals = matches.filter(
    (m) =>
      m.kind === "skill" ||
      m.id === "skill-engineer" ||
      m.id.includes("skill"),
  );
  if (skillEngineerSignals.length > 0 && skillEngineerSignals[0]!.score >= 2) {
    return "skill-engineer";
  }
  const buildSignals = matches.filter(
    (m) => m.kind === "tool" || m.id === "engineering-lead",
  );
  if (buildSignals.length > 0) {
    return "engineering-lead";
  }
  return undefined;
}
