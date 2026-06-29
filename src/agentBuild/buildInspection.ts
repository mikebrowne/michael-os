import { existsSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { execSync } from "node:child_process";
import type { BuildSessionRecord } from "./buildChecklist.js";
import { loadBuildSession } from "./buildChecklist.js";

const MAX_READ_BYTES = 32_000;
const DEFAULT_TAIL_LINES = 80;

export function resolveBuildWorktree(
  stateDir: string,
  slug: string,
  fallbackWorktree?: string,
): { worktreePath: string; runDir: string; session?: BuildSessionRecord } {
  const session = loadBuildSession(stateDir, slug);
  if (session) {
    return {
      worktreePath: session.worktreePath,
      runDir: session.runDir,
      session,
    };
  }
  if (fallbackWorktree) {
    return { worktreePath: fallbackWorktree, runDir: fallbackWorktree };
  }
  throw new Error(`No build session or worktree for slug ${slug}`);
}

export function readWorktreeFile(
  worktreePath: string,
  relativePath: string,
): { path: string; content: string; truncated: boolean } {
  const abs = resolve(worktreePath, relativePath);
  const normalizedWorktree = resolve(worktreePath);
  if (!abs.startsWith(normalizedWorktree + sep) && abs !== normalizedWorktree) {
    throw new Error("Path escapes worktree.");
  }
  if (!existsSync(abs)) {
    throw new Error(`File not found in worktree: ${relativePath}`);
  }
  const raw = readFileSync(abs, "utf-8");
  const truncated = raw.length > MAX_READ_BYTES;
  return {
    path: relativePath,
    content: truncated ? raw.slice(0, MAX_READ_BYTES) : raw,
    truncated,
  };
}

export function rerunSingleTest(
  worktreePath: string,
  testRelativePath: string,
): { passed: boolean; exitCode: number | null; log: string } {
  try {
    const output = execSync(
      `npx vitest run ${JSON.stringify(testRelativePath)}`,
      { cwd: worktreePath, encoding: "utf-8", stdio: "pipe" },
    );
    return { passed: true, exitCode: 0, log: output.slice(0, 8000) };
  } catch (error: unknown) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    const log = [err.stdout, err.stderr].filter(Boolean).join("\n");
    return {
      passed: false,
      exitCode: typeof err.status === "number" ? err.status : 1,
      log: log.slice(0, 8000),
    };
  }
}

export function tailBuildLog(
  runDir: string,
  lineCount: number = DEFAULT_TAIL_LINES,
): { path: string; content: string } {
  const candidates = [
    join(runDir, "cursor.log"),
    join(runDir, "build.log"),
    join(runDir, "green-gate.log"),
    join(runDir, "red-gate.log"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      const lines = readFileSync(path, "utf-8").split("\n").filter((l, i, a) =>
        l.length > 0 || i < a.length - 1,
      );
      return {
        path,
        content: lines.slice(-lineCount).join("\n"),
      };
    }
  }
  return { path: runDir, content: "(no build log file found in run directory)" };
}
