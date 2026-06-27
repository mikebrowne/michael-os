import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function slugifyRequest(request: string): string {
  const slug = request
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "task";
}

export function formatRunTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export type RunDirectory = {
  runDir: string;
  slug: string;
  timestamp: string;
  requestPath: string;
  specPath: string;
  cursorTaskPath: string;
  acceptanceTestPath: string;
  acceptanceHashPath: string;
  worktreePath: string;
  redGateLogPath: string;
  greenGateLogPath: string;
  preflightLogPath: string;
  diffPath: string;
  resultPath: string;
};

export function createRunDirectory(
  aiRunsDir: string,
  request: string,
  now: Date = new Date(),
): RunDirectory {
  const slug = slugifyRequest(request);
  const timestamp = formatRunTimestamp(now);
  const folderName = `${timestamp}-${slug}`;
  const runDir = join(aiRunsDir, folderName);
  mkdirSync(runDir, { recursive: true });

  const paths = {
    runDir,
    slug,
    timestamp,
    requestPath: join(runDir, "request.md"),
    specPath: join(runDir, "spec.md"),
    cursorTaskPath: join(runDir, "cursor-task.md"),
    acceptanceTestPath: join(runDir, "acceptance.test.ts"),
    acceptanceHashPath: join(runDir, "acceptance.sha256"),
    worktreePath: join(runDir, "worktree"),
    redGateLogPath: join(runDir, "red-gate.log"),
    greenGateLogPath: join(runDir, "green-gate.log"),
    preflightLogPath: join(runDir, "preflight.log"),
    diffPath: join(runDir, "git-diff.patch"),
    resultPath: join(runDir, "result.md"),
  };

  writeFileSync(paths.requestPath, `${request.trim()}\n`, "utf-8");
  return paths;
}
