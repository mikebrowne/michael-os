import { z } from "zod";

export const OBSERVABILITY_LEVELS = [
  "silent",
  "minimal",
  "standard",
  "verbose",
  "debug",
] as const;

export type ObservabilityLevel = (typeof OBSERVABILITY_LEVELS)[number];

const levelSchema = z.enum(OBSERVABILITY_LEVELS);

export type ObservabilityConfig = {
  level: ObservabilityLevel;
  /** Max JSONL file size in bytes before rotation */
  maxLogBytes: number;
  /** Max age of JSONL files in days */
  maxLogAgeDays: number;
  /** Sample rate 0-1 for verbose/debug spans at high volume */
  sampleRate: number;
};

const LEVEL_RANK: Record<ObservabilityLevel, number> = {
  silent: 0,
  minimal: 1,
  standard: 2,
  verbose: 3,
  debug: 4,
};

export function parseObservabilityLevel(raw: string | undefined): ObservabilityLevel {
  const normalized = (raw ?? "standard").toLowerCase();
  return levelSchema.parse(normalized);
}

export function shouldEmitAtLevel(
  configured: ObservabilityLevel,
  required: ObservabilityLevel,
): boolean {
  return LEVEL_RANK[configured] >= LEVEL_RANK[required];
}

export function createObservabilityConfig(options: {
  level?: ObservabilityLevel;
  maxLogBytes?: number;
  maxLogAgeDays?: number;
  sampleRate?: number;
}): ObservabilityConfig {
  return {
    level: options.level ?? "standard",
    maxLogBytes: options.maxLogBytes ?? 10 * 1024 * 1024,
    maxLogAgeDays: options.maxLogAgeDays ?? 14,
    sampleRate: options.sampleRate ?? 1,
  };
}
