import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SkillRegistration } from "../skills/skillRegistry.js";

export type SkillUsageCounts = Map<string, number>;

const USED_A_LOT_THRESHOLD = 5;

/**
 * Aggregate skill.activated events from observability JSONL.
 * Minimal "used-a-lot" signal for the Tool Author (Phase 6 D4 deferred hook).
 */
export function aggregateSkillActivationsFromJsonl(
  logFilePath: string,
): SkillUsageCounts {
  const counts: SkillUsageCounts = new Map();
  if (!existsSync(logFilePath)) return counts;

  const raw = readFileSync(logFilePath, "utf-8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as {
        event?: string;
        data?: { skillName?: string };
      };
      if (event.event !== "skill.activated") continue;
      const skillName = event.data?.skillName;
      if (typeof skillName !== "string") continue;
      counts.set(skillName, (counts.get(skillName) ?? 0) + 1);
    } catch {
      continue;
    }
  }
  return counts;
}

export function findHotSkills(
  counts: SkillUsageCounts,
  threshold = USED_A_LOT_THRESHOLD,
): string[] {
  return [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
}

export function isHotSkill(
  skillName: string,
  counts: SkillUsageCounts,
  threshold = USED_A_LOT_THRESHOLD,
): boolean {
  return (counts.get(skillName) ?? 0) >= threshold;
}

export function hotSkillRationale(
  skillName: string,
  counts: SkillUsageCounts,
): string {
  const count = counts.get(skillName) ?? 0;
  return `Skill "${skillName}" was activated ${count} times — consider hardening into a deterministic tool.`;
}

export function skillHasEvalCases(repoRoot: string, skillName: string): boolean {
  const evalsDir = join(repoRoot, "skills", skillName, "evals");
  if (!existsSync(evalsDir)) return false;
  return readdirSync(evalsDir).some((f) => f.endsWith(".json"));
}

export function assertSkillHasEvalBeforeActivation(
  repoRoot: string,
  skillName: string,
): { ok: true } | { ok: false; message: string } {
  if (skillHasEvalCases(repoRoot, skillName)) {
    return { ok: true };
  }
  return {
    ok: false,
    message: `Skill "${skillName}" cannot activate without at least one eval case in skills/${skillName}/evals/`,
  };
}

export function filterPromotableSkills(
  skills: SkillRegistration[],
): SkillRegistration[] {
  return skills.filter((s) => s.status === "active");
}
