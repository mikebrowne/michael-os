import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { PinoLogger } from "@mastra/loggers";

export type RunLogEvent = {
  runId: string;
  event: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type RunLoggerOptions = {
  logDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  name?: string;
};

export class RunLogger {
  readonly pino: PinoLogger;
  private readonly logFilePath: string;

  constructor(private readonly options: RunLoggerOptions) {
    mkdirSync(options.logDir, { recursive: true });
    this.logFilePath = join(options.logDir, "runs.jsonl");
    this.pino = new PinoLogger({
      name: options.name ?? "MichaelOS",
      level: options.logLevel,
    });
  }

  log(event: Omit<RunLogEvent, "timestamp">): RunLogEvent {
    const record: RunLogEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    appendFileSync(this.logFilePath, `${JSON.stringify(record)}\n`, "utf-8");
    this.pino.info(`${event.event} runId=${event.runId}`);
    return record;
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

export function createRunLogger(options: RunLoggerOptions): RunLogger {
  return new RunLogger(options);
}
