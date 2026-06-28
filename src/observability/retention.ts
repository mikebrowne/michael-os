import { readdirSync, statSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export function rotateJsonlIfNeeded(logFilePath: string, maxBytes: number): void {
  try {
    const stat = statSync(logFilePath);
    if (stat.size < maxBytes) return;
    const rotated = `${logFilePath}.${Date.now()}.jsonl`;
    renameSync(logFilePath, rotated);
  } catch {
    // file may not exist yet
  }
}

export function pruneOldLogFiles(logDir: string, maxAgeDays: number): number {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    for (const name of readdirSync(logDir)) {
      if (!name.endsWith(".jsonl")) continue;
      const path = join(logDir, name);
      const stat = statSync(path);
      if (stat.mtimeMs < cutoff) {
        unlinkSync(path);
        removed += 1;
      }
    }
  } catch {
    // log dir may not exist
  }
  return removed;
}
