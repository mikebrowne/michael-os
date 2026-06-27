import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const defaultConfigSchema = z.object({
  appName: z.string(),
  defaultModel: z.string(),
  defaultCodingModel: z.string().optional(),
});

export type AppConfig = {
  appName: string;
  defaultModel: string;
  defaultCodingModel: string;
  vaultPath: string;
  logDir: string;
  aiRunsDir: string;
  prdsDir: string;
  stateDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  openaiApiKey?: string;
  cursorApiKey?: string;
};

const DEMO_VAULT_RELATIVE = join("examples", "demo-vault");
const DEFAULT_CODING_MODEL = "composer-2.5";

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

export function loadConfig(cwd: string = process.cwd()): AppConfig {
  loadDotenv({ path: join(cwd, ".env") });

  const defaultJson = defaultConfigSchema.parse(
    readJsonFile(join(cwd, "config", "default.json")),
  );

  const localJson = readJsonFile(join(cwd, "config", "local.json"));
  const merged = { ...defaultJson, ...localJson };

  const vaultPathEnv = process.env.VAULT_PATH?.trim();
  const vaultPath = vaultPathEnv
    ? resolve(vaultPathEnv)
    : resolve(cwd, DEMO_VAULT_RELATIVE);

  const logDir = resolve(cwd, process.env.LOG_DIR?.trim() || ".logs");
  const aiRunsDir = resolve(cwd, process.env.AI_RUNS_DIR?.trim() || "ai-runs");
  const prdsDir = resolve(cwd, process.env.PRDS_DIR?.trim() || join("docs", "prds"));
  const stateDir = resolve(cwd, process.env.STATE_DIR?.trim() || join(".mastra", "state"));

  const logLevelRaw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  const logLevel = z
    .enum(["debug", "info", "warn", "error"])
    .parse(logLevelRaw);

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;
  const cursorApiKey = process.env.CURSOR_API_KEY?.trim() || undefined;

  return {
    appName: String(merged.appName),
    defaultModel: String(merged.defaultModel),
    defaultCodingModel:
      String(merged.defaultCodingModel ?? DEFAULT_CODING_MODEL),
    vaultPath,
    logDir,
    aiRunsDir,
    prdsDir,
    stateDir,
    logLevel,
    openaiApiKey,
    cursorApiKey,
  };
}

export function requireOpenAiKey(config: AppConfig): string {
  if (!config.openaiApiKey || config.openaiApiKey.startsWith("your-")) {
    throw new Error(
      "OPENAI_API_KEY is missing or still a placeholder. Copy .env.example to .env and set your key for npm run demo or agent:build.",
    );
  }
  return config.openaiApiKey;
}

export function requireCursorKey(config: AppConfig): string {
  if (!config.cursorApiKey || config.cursorApiKey.startsWith("your-")) {
    throw new Error(
      "CURSOR_API_KEY is missing or still a placeholder. Copy .env.example to .env and set your key for npm run agent:build.",
    );
  }
  return config.cursorApiKey;
}
