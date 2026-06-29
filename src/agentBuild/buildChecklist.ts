import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type BuildSliceStatus =
  | "pending"
  | "inProgress"
  | "completed"
  | "cancelled"
  | "failed";

export type BuildSlice = {
  id: string;
  title: string;
  status: BuildSliceStatus;
};

export type BuildSessionStatus =
  | "planning"
  | "planned"
  | "building"
  | "verifying"
  | "finished"
  | "cancelled"
  | "blocked";

export type BuildSessionRecord = {
  id: string;
  slug: string;
  agentId: string;
  worktreePath: string;
  runDir: string;
  planMarkdown: string;
  slices: BuildSlice[];
  currentSliceIndex: number;
  status: BuildSessionStatus;
  clarifyingRounds: number;
  acceptanceRelativePath: string;
  acceptanceHash?: string;
  createdAt: string;
  updatedAt: string;
};

export function buildSessionDir(stateDir: string): string {
  return join(stateDir, "build-sessions");
}

export function buildSessionPath(stateDir: string, slug: string): string {
  return join(buildSessionDir(stateDir), `${slug}.json`);
}

export function saveBuildSession(
  stateDir: string,
  session: BuildSessionRecord,
): BuildSessionRecord {
  const dir = buildSessionDir(stateDir);
  mkdirSync(dir, { recursive: true });
  const updated = { ...session, updatedAt: new Date().toISOString() };
  writeFileSync(
    buildSessionPath(stateDir, session.slug),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf-8",
  );
  return updated;
}

export function loadBuildSession(
  stateDir: string,
  slug: string,
): BuildSessionRecord | undefined {
  const path = buildSessionPath(stateDir, slug);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf-8")) as BuildSessionRecord;
}

export function listBuildSessions(stateDir: string): BuildSessionRecord[] {
  const dir = buildSessionDir(stateDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => f.endsWith(".json"))
    .map((f: string) =>
      JSON.parse(readFileSync(join(dir, f), "utf-8")) as BuildSessionRecord,
    );
}

/** Parse markdown plan bullets / checklist items into bounded slices. */
export function parsePlanSlices(planMarkdown: string): BuildSlice[] {
  const lines = planMarkdown.split("\n");
  const slices: BuildSlice[] = [];
  let index = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const checkbox = trimmed.match(/^[-*]\s+\[[ xX]?\]\s+(.+)$/);
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    const numbered = trimmed.match(/^\d+\.\s+(.+)$/);
    const title = checkbox?.[1] ?? bullet?.[1] ?? numbered?.[1];
    if (!title) continue;
    index += 1;
    slices.push({
      id: `slice-${index}`,
      title: title.trim(),
      status: "pending",
    });
  }

  if (slices.length === 0 && planMarkdown.trim()) {
    slices.push({
      id: "slice-1",
      title: "Implement approved plan",
      status: "pending",
    });
  }

  return slices;
}

export function formatBuildSessionSummary(session: BuildSessionRecord): string {
  const completed = session.slices.filter((s) => s.status === "completed").length;
  const lines = [
    `Build session ${session.id} (${session.status})`,
    `Agent: ${session.agentId}`,
    `Worktree: ${session.worktreePath}`,
    `Slices: ${completed}/${session.slices.length} completed`,
  ];
  if (session.currentSliceIndex < session.slices.length) {
    const current = session.slices[session.currentSliceIndex];
    lines.push(`Current: ${current?.title ?? "none"} (${current?.status ?? "n/a"})`);
  }
  return lines.join("\n");
}
