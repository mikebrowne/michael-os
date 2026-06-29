import { Agent } from "@cursor/sdk";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatBuildSessionSummary,
  listBuildSessions,
  loadBuildSession,
  type BuildSessionRecord,
} from "./buildChecklist.js";
import { configureCursorSdkStore } from "./cursorSdkStore.js";
import { captureGitDiff, listChangedFiles } from "./worktree.js";
import type { AppConfig } from "../config/loadConfig.js";

export type BuildListLine = {
  id: string;
  slug: string;
  status: string;
  agentId: string;
  slices: string;
};

export function listLocalBuildSessions(stateDir: string): BuildSessionRecord[] {
  return listBuildSessions(stateDir).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function formatBuildListLine(session: BuildSessionRecord): string {
  const completed = session.slices.filter((s) => s.status === "completed").length;
  return `${session.slug} | ${session.status} | agent=${session.agentId.slice(0, 8)}… | slices ${completed}/${session.slices.length}`;
}

export function formatBuildDetail(
  config: AppConfig,
  sessionIdOrSlug: string,
): string {
  const sessions = listLocalBuildSessions(config.stateDir);
  const session =
    sessions.find((s) => s.id === sessionIdOrSlug || s.slug === sessionIdOrSlug) ??
    sessions.find((s) => s.agentId.startsWith(sessionIdOrSlug));

  if (!session) {
    return `No build session matching "${sessionIdOrSlug}".`;
  }

  const lines = [formatBuildSessionSummary(session), ""];

  if (existsSync(session.worktreePath)) {
    const changed = listChangedFiles(session.worktreePath);
    lines.push(`Changed files (${changed.length}): ${changed.join(", ") || "(none)"}`);
    const diff = captureGitDiff(session.worktreePath);
    lines.push("", "Diff summary (first 2000 chars):", diff.slice(0, 2000) || "(empty)");
  } else {
    lines.push("(worktree no longer present)");
  }

  const planPath = join(session.runDir, "build-plan.md");
  if (existsSync(planPath)) {
    const plan = readFileSync(planPath, "utf-8");
    lines.push("", "Plan excerpt:", plan.slice(0, 1500));
  }

  return lines.join("\n");
}

export async function listCursorAgents(
  config: AppConfig,
  repoPath: string,
): Promise<string[]> {
  configureCursorSdkStore(config.mastraDir);
  try {
    const result = await Agent.list({
      runtime: "local",
      cwd: repoPath,
      limit: 20,
    });
    return result.items.map(
      (a) =>
        `${a.agentId} | ${a.status ?? "unknown"} | ${a.name ?? "(unnamed)"}`,
    );
  } catch {
    return ["(Agent.list unavailable — no local agents or SDK store empty)"];
  }
}

export async function resumeBuildSessionAgent(
  config: AppConfig,
  slug: string,
): Promise<string> {
  const session = loadBuildSession(config.stateDir, slug);
  if (!session) return `No session for ${slug}`;
  configureCursorSdkStore(config.mastraDir);
  const agent = await Agent.resume(session.agentId, {
    apiKey: config.cursorApiKey,
    local: { cwd: session.worktreePath, settingSources: ["project"] },
  });
  agent.close();
  return `Resumed agent ${session.agentId} for ${slug}.`;
}
