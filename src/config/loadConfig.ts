import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

const defaultConfigSchema = z.object({
  appName: z.string(),
  defaultModel: z.string(),
});

export type AppConfig = {
  appName: string;
  defaultModel: string;
  vaultPath: string;
  logDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  openaiApiKey?: string;
};

const DEMO_VAULT_RELATIVE = join("examples", "demo-vault");

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

  const logLevelRaw = (process.env.LOG_LEVEL ?? "info").toLowerCase();
  const logLevel = z
    .enum(["debug", "info", "warn", "error"])
    .parse(logLevelRaw);

  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;

  return {
    appName: String(merged.appName),
    defaultModel: String(merged.defaultModel),
    vaultPath,
    logDir,
    logLevel,
    openaiApiKey,
  };
}

export function requireOpenAiKey(config: AppConfig): string {
  if (!config.openaiApiKey || config.openaiApiKey.startsWith("your-")) {
    throw new Error(
      "OPENAI_API_KEY is missing or still a placeholder. Copy .env.example to .env and set your key for npm run demo.",
    );
  }
  return config.openaiApiKey;
}
